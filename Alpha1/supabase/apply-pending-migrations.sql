-- AUTO-GENERATED — all migrations bundle
-- Run once via: npm run db:apply:bundle
-- Regenerate: npm run db:build-pending

-- ========== 202605180001_auth_profiles_usage.sql ==========
create extension if not exists pgcrypto;

do $$ begin
  create type public.user_plan as enum ('beta_pro', 'trial', 'admin', 'suspended');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.usage_event_type as enum (
    'vision_scan',
    'vision_scan_refund',
    'scan_session_save',
    'card_save',
    'rate_limit_block'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null unique,
  email text,
  display_name text,
  avatar_url text,
  plan public.user_plan not null default 'trial',
  beta_number integer unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_active_at timestamptz,
  deleted_at timestamptz,
  constraint app_users_beta_number_positive check (beta_number is null or beta_number > 0)
);

create table if not exists public.profiles (
  user_id uuid primary key references public.app_users(id) on delete cascade,
  public_handle text unique,
  collector_type text,
  favorite_tcg text default 'Pokemon',
  settings_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scan_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  title text not null default 'Untitled scan',
  specimen_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.extracted_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  session_id uuid references public.scan_sessions(id) on delete set null,
  name text not null,
  printed_name text,
  language text,
  set_name text,
  card_number text,
  year text,
  rarity text,
  print_stamps text,
  grader text,
  grade text,
  cert text,
  catalog_id text,
  catalog_confidence numeric,
  market_snapshot_json jsonb not null default '{}'::jsonb,
  raw_extraction_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.usage_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  event_type public.usage_event_type not null,
  credits_used integer not null default 0,
  route text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint usage_ledger_credits_nonnegative check (credits_used >= 0)
);

create table if not exists public.usage_counters (
  user_id uuid not null references public.app_users(id) on delete cascade,
  day_key date not null,
  month_key date not null,
  daily_used integer not null default 0,
  monthly_used integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, day_key, month_key),
  constraint usage_counters_daily_nonnegative check (daily_used >= 0),
  constraint usage_counters_monthly_nonnegative check (monthly_used >= 0)
);

create index if not exists app_users_plan_idx on public.app_users(plan);
create index if not exists app_users_created_at_idx on public.app_users(created_at);
create index if not exists scan_sessions_user_updated_idx on public.scan_sessions(user_id, updated_at desc);
create index if not exists extracted_cards_user_created_idx on public.extracted_cards(user_id, created_at desc);
create index if not exists extracted_cards_catalog_idx on public.extracted_cards(catalog_id);
create index if not exists usage_ledger_user_created_idx on public.usage_ledger(user_id, created_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists app_users_touch_updated_at on public.app_users;
create trigger app_users_touch_updated_at
before update on public.app_users
for each row execute function public.touch_updated_at();

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists scan_sessions_touch_updated_at on public.scan_sessions;
create trigger scan_sessions_touch_updated_at
before update on public.scan_sessions
for each row execute function public.touch_updated_at();

drop trigger if exists extracted_cards_touch_updated_at on public.extracted_cards;
create trigger extracted_cards_touch_updated_at
before update on public.extracted_cards
for each row execute function public.touch_updated_at();

create or replace function public.sync_clerk_user(
  p_clerk_user_id text,
  p_email text,
  p_display_name text,
  p_avatar_url text
)
returns public.app_users
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.app_users;
  next_beta_number integer;
  synced public.app_users;
begin
  if nullif(trim(p_clerk_user_id), '') is null then
    raise exception 'clerk_user_id is required';
  end if;

  perform pg_advisory_xact_lock(hashtext('pgt_beta_assignment_v1'));

  select * into existing
  from public.app_users
  where clerk_user_id = p_clerk_user_id;

  if found then
    update public.app_users
    set
      email = nullif(trim(p_email), ''),
      display_name = nullif(trim(p_display_name), ''),
      avatar_url = nullif(trim(p_avatar_url), ''),
      deleted_at = null,
      last_active_at = coalesce(last_active_at, now())
    where id = existing.id
    returning * into synced;
  else
    select coalesce(max(beta_number), 0) + 1 into next_beta_number
    from public.app_users
    where beta_number is not null;

    insert into public.app_users (
      clerk_user_id,
      email,
      display_name,
      avatar_url,
      plan,
      beta_number,
      last_active_at
    )
    values (
      p_clerk_user_id,
      nullif(trim(p_email), ''),
      nullif(trim(p_display_name), ''),
      nullif(trim(p_avatar_url), ''),
      case when next_beta_number <= 500 then 'beta_pro'::public.user_plan else 'trial'::public.user_plan end,
      case when next_beta_number <= 500 then next_beta_number else null end,
      now()
    )
    returning * into synced;

    insert into public.profiles (user_id)
    values (synced.id)
    on conflict (user_id) do nothing;
  end if;

  return synced;
end;
$$;

create or replace function public.mark_clerk_user_deleted(p_clerk_user_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.app_users
  set deleted_at = now()
  where clerk_user_id = p_clerk_user_id;
end;
$$;

create or replace function public.consume_scan_credits(
  p_app_user_id uuid,
  p_credits integer,
  p_route text,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  allowed boolean,
  reason text,
  daily_used integer,
  monthly_used integer,
  daily_limit integer,
  monthly_limit integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  user_row public.app_users;
  current_day date := current_date;
  current_month date := date_trunc('month', now())::date;
  current_daily integer := 0;
  current_monthly integer := 0;
  next_daily integer;
  next_monthly integer;
begin
  if p_credits <= 0 then
    raise exception 'credits must be positive';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_app_user_id::text));

  select * into user_row
  from public.app_users
  where id = p_app_user_id and deleted_at is null
  for update;

  if not found then
    allowed := false;
    reason := 'user_not_found';
    daily_used := 0;
    monthly_used := 0;
    daily_limit := 0;
    monthly_limit := 0;
    return next;
    return;
  end if;

  if user_row.plan = 'admin' then
    daily_limit := null;
    monthly_limit := null;
  elsif user_row.plan = 'beta_pro' then
    daily_limit := 50;
    monthly_limit := 1500;
  elsif user_row.plan = 'trial' then
    daily_limit := 5;
    monthly_limit := 150;
  else
    daily_limit := 0;
    monthly_limit := 0;
  end if;

  select coalesce(uc.daily_used, 0), coalesce(uc.monthly_used, 0)
  into current_daily, current_monthly
  from public.usage_counters uc
  where uc.user_id = p_app_user_id
    and uc.day_key = current_day
    and uc.month_key = current_month
  for update;

  current_daily := coalesce(current_daily, 0);
  current_monthly := coalesce(current_monthly, 0);
  next_daily := current_daily + p_credits;
  next_monthly := current_monthly + p_credits;

  if user_row.plan = 'suspended' then
    insert into public.usage_ledger (user_id, event_type, credits_used, route, metadata_json)
    values (p_app_user_id, 'rate_limit_block', 0, p_route, p_metadata || '{"reason":"suspended"}'::jsonb);

    allowed := false;
    reason := 'suspended';
    daily_used := current_daily;
    monthly_used := current_monthly;
    return next;
    return;
  end if;

  if daily_limit is not null and next_daily > daily_limit then
    insert into public.usage_ledger (user_id, event_type, credits_used, route, metadata_json)
    values (p_app_user_id, 'rate_limit_block', 0, p_route, p_metadata || '{"reason":"daily_limit"}'::jsonb);

    allowed := false;
    reason := 'daily_limit';
    daily_used := current_daily;
    monthly_used := current_monthly;
    return next;
    return;
  end if;

  if monthly_limit is not null and next_monthly > monthly_limit then
    insert into public.usage_ledger (user_id, event_type, credits_used, route, metadata_json)
    values (p_app_user_id, 'rate_limit_block', 0, p_route, p_metadata || '{"reason":"monthly_limit"}'::jsonb);

    allowed := false;
    reason := 'monthly_limit';
    daily_used := current_daily;
    monthly_used := current_monthly;
    return next;
    return;
  end if;

  insert into public.usage_counters (user_id, day_key, month_key, daily_used, monthly_used)
  values (p_app_user_id, current_day, current_month, p_credits, p_credits)
  on conflict (user_id, day_key, month_key)
  do update set
    daily_used = public.usage_counters.daily_used + excluded.daily_used,
    monthly_used = public.usage_counters.monthly_used + excluded.monthly_used,
    updated_at = now()
  returning public.usage_counters.daily_used, public.usage_counters.monthly_used
  into next_daily, next_monthly;

  insert into public.usage_ledger (user_id, event_type, credits_used, route, metadata_json)
  values (p_app_user_id, 'vision_scan', p_credits, p_route, p_metadata);

  update public.app_users
  set last_active_at = now()
  where id = p_app_user_id;

  allowed := true;
  reason := 'ok';
  daily_used := next_daily;
  monthly_used := next_monthly;
  return next;
end;
$$;

alter table public.app_users enable row level security;
alter table public.profiles enable row level security;
alter table public.scan_sessions enable row level security;
alter table public.extracted_cards enable row level security;
alter table public.usage_ledger enable row level security;
alter table public.usage_counters enable row level security;


-- ========== 202605180002_companion.sql ==========
create table if not exists public.user_companions (
  user_id uuid primary key references public.app_users(id) on delete cascade,
  pokemon_id integer not null,
  pokemon_name text not null,
  pokemon_slug text not null,
  pokemon_tier text not null default 'starter',
  pokemon_era text not null default '',
  hatched_at timestamptz not null default now(),
  level integer not null default 1,
  xp integer not null default 0,
  hunger integer not null default 80,
  energy integer not null default 85,
  mood integer not null default 75,
  last_tick_at timestamptz not null default now(),
  action_cooldowns jsonb not null default '{}'::jsonb,
  task_progress jsonb not null default '{}'::jsonb,
  task_claimed jsonb not null default '{}'::jsonb,
  lifetime_stats jsonb not null default '{}'::jsonb,
  usage_scans_this_week integer not null default 0,
  usage_week_key date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_companions_level_positive check (level >= 1),
  constraint user_companions_stats_range check (
    hunger between 0 and 100 and energy between 0 and 100 and mood between 0 and 100
  )
);

create index if not exists user_companions_hatched_idx on public.user_companions(hatched_at desc);

drop trigger if exists user_companions_touch_updated_at on public.user_companions;
create trigger user_companions_touch_updated_at
before update on public.user_companions
for each row execute function public.touch_updated_at();

alter table public.user_companions enable row level security;


-- ========== 202605190001_billing_pro_bonus.sql ==========
-- Pro plan, bonus scan balance, raised free limits (sync with src/lib/auth/plans.ts)

do $$ begin
  alter type public.user_plan add value if not exists 'pro';
exception
  when duplicate_object then null;
end $$;

alter table public.app_users
  add column if not exists bonus_scans integer not null default 0;

alter table public.app_users
  drop constraint if exists app_users_bonus_scans_non_negative;

alter table public.app_users
  add constraint app_users_bonus_scans_non_negative check (bonus_scans >= 0);

-- Return type adds bonus_scans; CREATE OR REPLACE cannot change OUT columns (42P13).
drop function if exists public.consume_scan_credits(uuid, integer, text, jsonb);

create or replace function public.consume_scan_credits(
  p_app_user_id uuid,
  p_credits integer,
  p_route text,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  allowed boolean,
  reason text,
  daily_used integer,
  monthly_used integer,
  daily_limit integer,
  monthly_limit integer,
  bonus_scans integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  user_row public.app_users%rowtype;
  current_daily integer;
  current_monthly integer;
  next_daily integer;
  next_monthly integer;
  current_day date := (now() at time zone 'utc')::date;
  current_month date := date_trunc('month', now() at time zone 'utc')::date;
  daily_limit_val integer;
  monthly_limit_val integer;
  within_daily boolean;
  within_monthly boolean;
begin
  if p_credits < 1 then
    raise exception 'p_credits must be >= 1';
  end if;

  select * into user_row
  from public.app_users
  where id = p_app_user_id
  for update;

  if not found then
    allowed := false;
    reason := 'user_not_found';
    daily_used := 0;
    monthly_used := 0;
    daily_limit := 0;
    monthly_limit := 0;
    bonus_scans := 0;
    return next;
    return;
  end if;

  if user_row.plan = 'admin' then
    daily_limit_val := null;
    monthly_limit_val := null;
  elsif user_row.plan in ('beta_pro', 'pro') then
    daily_limit_val := 80;
    monthly_limit_val := 3000;
  elsif user_row.plan = 'trial' then
    daily_limit_val := null;
    monthly_limit_val := 15;
  else
    daily_limit_val := 0;
    monthly_limit_val := 0;
  end if;

  select coalesce(uc.daily_used, 0), coalesce(uc.monthly_used, 0)
  into current_daily, current_monthly
  from public.usage_counters uc
  where uc.user_id = p_app_user_id
    and uc.day_key = current_day
    and uc.month_key = current_month
  for update;

  current_daily := coalesce(current_daily, 0);
  current_monthly := coalesce(current_monthly, 0);
  next_daily := current_daily + p_credits;
  next_monthly := current_monthly + p_credits;

  daily_limit := daily_limit_val;
  monthly_limit := monthly_limit_val;
  bonus_scans := user_row.bonus_scans;

  if user_row.plan = 'suspended' then
    insert into public.usage_ledger (user_id, event_type, credits_used, route, metadata_json)
    values (p_app_user_id, 'rate_limit_block', 0, p_route, p_metadata || '{"reason":"suspended"}'::jsonb);

    allowed := false;
    reason := 'suspended';
    daily_used := current_daily;
    monthly_used := current_monthly;
    return next;
    return;
  end if;

  if user_row.plan = 'admin' then
    insert into public.usage_counters (user_id, day_key, month_key, daily_used, monthly_used)
    values (p_app_user_id, current_day, current_month, p_credits, p_credits)
    on conflict (user_id, day_key, month_key)
    do update set
      daily_used = public.usage_counters.daily_used + excluded.daily_used,
      monthly_used = public.usage_counters.monthly_used + excluded.monthly_used,
      updated_at = now()
    returning public.usage_counters.daily_used, public.usage_counters.monthly_used
    into next_daily, next_monthly;

    insert into public.usage_ledger (user_id, event_type, credits_used, route, metadata_json)
    values (p_app_user_id, 'vision_scan', p_credits, p_route, p_metadata);

    update public.app_users set last_active_at = now() where id = p_app_user_id;

    allowed := true;
    reason := 'ok';
    daily_used := next_daily;
    monthly_used := next_monthly;
    bonus_scans := user_row.bonus_scans;
    return next;
    return;
  end if;

  within_daily := daily_limit_val is null or next_daily <= daily_limit_val;
  within_monthly := monthly_limit_val is null or next_monthly <= monthly_limit_val;

  if within_daily and within_monthly then
    insert into public.usage_counters (user_id, day_key, month_key, daily_used, monthly_used)
    values (p_app_user_id, current_day, current_month, p_credits, p_credits)
    on conflict (user_id, day_key, month_key)
    do update set
      daily_used = public.usage_counters.daily_used + excluded.daily_used,
      monthly_used = public.usage_counters.monthly_used + excluded.monthly_used,
      updated_at = now()
    returning public.usage_counters.daily_used, public.usage_counters.monthly_used
    into next_daily, next_monthly;

    insert into public.usage_ledger (user_id, event_type, credits_used, route, metadata_json)
    values (p_app_user_id, 'vision_scan', p_credits, p_route, p_metadata);

    update public.app_users set last_active_at = now() where id = p_app_user_id;

    allowed := true;
    reason := 'ok';
    daily_used := next_daily;
    monthly_used := next_monthly;
    bonus_scans := user_row.bonus_scans;
    return next;
    return;
  end if;

  if user_row.bonus_scans >= p_credits then
    update public.app_users
    set
      bonus_scans = bonus_scans - p_credits,
      last_active_at = now()
    where id = p_app_user_id
    returning bonus_scans into bonus_scans;

    insert into public.usage_ledger (user_id, event_type, credits_used, route, metadata_json)
    values (
      p_app_user_id,
      'vision_scan',
      p_credits,
      p_route,
      p_metadata || jsonb_build_object('bonus_scan', true)
    );

    allowed := true;
    reason := 'bonus';
    daily_used := current_daily;
    monthly_used := current_monthly;
    return next;
    return;
  end if;

  if not within_daily then
    insert into public.usage_ledger (user_id, event_type, credits_used, route, metadata_json)
    values (p_app_user_id, 'rate_limit_block', 0, p_route, p_metadata || '{"reason":"daily_limit"}'::jsonb);

    allowed := false;
    reason := 'daily_limit';
    daily_used := current_daily;
    monthly_used := current_monthly;
    return next;
    return;
  end if;

  insert into public.usage_ledger (user_id, event_type, credits_used, route, metadata_json)
  values (p_app_user_id, 'rate_limit_block', 0, p_route, p_metadata || '{"reason":"monthly_limit"}'::jsonb);

  allowed := false;
  reason := 'monthly_limit';
  daily_used := current_daily;
  monthly_used := current_monthly;
  return next;
end;
$$;


-- ========== 202605190002_master_admin_billing.sql ==========
-- Master admin email + bonus scan grants (sync with src/lib/auth/admin.ts)

create or replace function public.add_bonus_scans(
  p_app_user_id uuid,
  p_credits integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance integer;
begin
  if p_credits < 1 then
    raise exception 'p_credits must be >= 1';
  end if;

  update public.app_users
  set bonus_scans = bonus_scans + p_credits
  where id = p_app_user_id
  returning bonus_scans into new_balance;

  if not found then
    raise exception 'user not found';
  end if;

  return new_balance;
end;
$$;

create or replace function public.sync_clerk_user(
  p_clerk_user_id text,
  p_email text,
  p_display_name text,
  p_avatar_url text
)
returns public.app_users
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.app_users;
  next_beta_number integer;
  synced public.app_users;
  normalized_email text;
  is_master_admin boolean;
  master_admin_email constant text := 'solarverse2022@gmail.com';
begin
  if nullif(trim(p_clerk_user_id), '') is null then
    raise exception 'clerk_user_id is required';
  end if;

  normalized_email := lower(trim(coalesce(p_email, '')));
  is_master_admin := normalized_email = master_admin_email;

  perform pg_advisory_xact_lock(hashtext('pgt_beta_assignment_v1'));

  select * into existing
  from public.app_users
  where clerk_user_id = p_clerk_user_id;

  if found then
    update public.app_users
    set
      email = nullif(trim(p_email), ''),
      display_name = nullif(trim(p_display_name), ''),
      avatar_url = nullif(trim(p_avatar_url), ''),
      deleted_at = null,
      plan = case
        when is_master_admin then 'admin'::public.user_plan
        when existing.plan = 'admin'::public.user_plan then 'trial'::public.user_plan
        else existing.plan
      end,
      last_active_at = coalesce(last_active_at, now())
    where id = existing.id
    returning * into synced;
  else
    select coalesce(max(beta_number), 0) + 1 into next_beta_number
    from public.app_users
    where beta_number is not null;

    insert into public.app_users (
      clerk_user_id,
      email,
      display_name,
      avatar_url,
      plan,
      beta_number,
      last_active_at
    )
    values (
      p_clerk_user_id,
      nullif(trim(p_email), ''),
      nullif(trim(p_display_name), ''),
      nullif(trim(p_avatar_url), ''),
      case
        when is_master_admin then 'admin'::public.user_plan
        when next_beta_number <= 500 then 'beta_pro'::public.user_plan
        else 'trial'::public.user_plan
      end,
      case
        when is_master_admin then null
        when next_beta_number <= 500 then next_beta_number
        else null
      end,
      now()
    )
    returning * into synced;

    insert into public.profiles (user_id)
    values (synced.id)
    on conflict (user_id) do nothing;
  end if;

  return synced;
end;
$$;


-- ========== 202605200001_pokemon_sprite_assets.sql ==========
-- Master Pokémon sprite catalog (Option B).
-- Safe to apply on existing projects: new table only, no changes to scan/companion tables.
-- Populate via scripts/sync-companion-sprites-storage.mjs or future PGT Market sync.

create table if not exists public.pokemon_sprite_assets (
  national_id integer primary key,
  showdown_slug text not null,
  has_ani boolean not null default false,
  has_artwork boolean not null default false,
  ani_storage_path text,
  artwork_storage_path text,
  ani_public_url text,
  artwork_public_url text,
  source text not null default 'showdown',
  metadata_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists pokemon_sprite_assets_slug_idx
  on public.pokemon_sprite_assets (showdown_slug);

comment on table public.pokemon_sprite_assets is
  'Hosted sprite manifest for companion/battle UI. Sync from Showdown upload or PGT Market master DB.';

alter table public.pokemon_sprite_assets enable row level security;

-- Public read for CDN URLs (no write from client)
drop policy if exists pokemon_sprite_assets_public_read on public.pokemon_sprite_assets;
create policy pokemon_sprite_assets_public_read
  on public.pokemon_sprite_assets
  for select
  to anon, authenticated
  using (true);


-- ========== 202605200002_free_tier_monthly_scans.sql ==========
-- Free tier (trial): 15 scans per month only — no daily cap (sync with src/lib/auth/plans.ts)

drop function if exists public.consume_scan_credits(uuid, integer, text, jsonb);

create or replace function public.consume_scan_credits(
  p_app_user_id uuid,
  p_credits integer,
  p_route text,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  allowed boolean,
  reason text,
  daily_used integer,
  monthly_used integer,
  daily_limit integer,
  monthly_limit integer,
  bonus_scans integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  user_row public.app_users%rowtype;
  current_daily integer;
  current_monthly integer;
  next_daily integer;
  next_monthly integer;
  current_day date := (now() at time zone 'utc')::date;
  current_month date := date_trunc('month', now() at time zone 'utc')::date;
  daily_limit_val integer;
  monthly_limit_val integer;
  within_daily boolean;
  within_monthly boolean;
begin
  if p_credits < 1 then
    raise exception 'p_credits must be >= 1';
  end if;

  select * into user_row
  from public.app_users
  where id = p_app_user_id
  for update;

  if not found then
    allowed := false;
    reason := 'user_not_found';
    daily_used := 0;
    monthly_used := 0;
    daily_limit := 0;
    monthly_limit := 0;
    bonus_scans := 0;
    return next;
    return;
  end if;

  if user_row.plan = 'admin' then
    daily_limit_val := null;
    monthly_limit_val := null;
  elsif user_row.plan in ('beta_pro', 'pro') then
    daily_limit_val := 80;
    monthly_limit_val := 3000;
  elsif user_row.plan = 'trial' then
    daily_limit_val := null;
    monthly_limit_val := 15;
  else
    daily_limit_val := 0;
    monthly_limit_val := 0;
  end if;

  select coalesce(uc.daily_used, 0), coalesce(uc.monthly_used, 0)
  into current_daily, current_monthly
  from public.usage_counters uc
  where uc.user_id = p_app_user_id
    and uc.day_key = current_day
    and uc.month_key = current_month
  for update;

  current_daily := coalesce(current_daily, 0);
  current_monthly := coalesce(current_monthly, 0);
  next_daily := current_daily + p_credits;
  next_monthly := current_monthly + p_credits;

  daily_limit := daily_limit_val;
  monthly_limit := monthly_limit_val;
  bonus_scans := user_row.bonus_scans;

  if user_row.plan = 'suspended' then
    insert into public.usage_ledger (user_id, event_type, credits_used, route, metadata_json)
    values (p_app_user_id, 'rate_limit_block', 0, p_route, p_metadata || '{"reason":"suspended"}'::jsonb);

    allowed := false;
    reason := 'suspended';
    daily_used := current_daily;
    monthly_used := current_monthly;
    return next;
    return;
  end if;

  if user_row.plan = 'admin' then
    insert into public.usage_counters (user_id, day_key, month_key, daily_used, monthly_used)
    values (p_app_user_id, current_day, current_month, p_credits, p_credits)
    on conflict (user_id, day_key, month_key)
    do update set
      daily_used = public.usage_counters.daily_used + excluded.daily_used,
      monthly_used = public.usage_counters.monthly_used + excluded.monthly_used,
      updated_at = now()
    returning public.usage_counters.daily_used, public.usage_counters.monthly_used
    into next_daily, next_monthly;

    insert into public.usage_ledger (user_id, event_type, credits_used, route, metadata_json)
    values (p_app_user_id, 'vision_scan', p_credits, p_route, p_metadata);

    update public.app_users set last_active_at = now() where id = p_app_user_id;

    allowed := true;
    reason := 'ok';
    daily_used := next_daily;
    monthly_used := next_monthly;
    bonus_scans := user_row.bonus_scans;
    return next;
    return;
  end if;

  within_daily := daily_limit_val is null or next_daily <= daily_limit_val;
  within_monthly := monthly_limit_val is null or next_monthly <= monthly_limit_val;

  if within_daily and within_monthly then
    insert into public.usage_counters (user_id, day_key, month_key, daily_used, monthly_used)
    values (p_app_user_id, current_day, current_month, p_credits, p_credits)
    on conflict (user_id, day_key, month_key)
    do update set
      daily_used = public.usage_counters.daily_used + excluded.daily_used,
      monthly_used = public.usage_counters.monthly_used + excluded.monthly_used,
      updated_at = now()
    returning public.usage_counters.daily_used, public.usage_counters.monthly_used
    into next_daily, next_monthly;

    insert into public.usage_ledger (user_id, event_type, credits_used, route, metadata_json)
    values (p_app_user_id, 'vision_scan', p_credits, p_route, p_metadata);

    update public.app_users set last_active_at = now() where id = p_app_user_id;

    allowed := true;
    reason := 'ok';
    daily_used := next_daily;
    monthly_used := next_monthly;
    bonus_scans := user_row.bonus_scans;
    return next;
    return;
  end if;

  if user_row.bonus_scans >= p_credits then
    update public.app_users
    set
      bonus_scans = bonus_scans - p_credits,
      last_active_at = now()
    where id = p_app_user_id
    returning bonus_scans into bonus_scans;

    insert into public.usage_ledger (user_id, event_type, credits_used, route, metadata_json)
    values (
      p_app_user_id,
      'vision_scan',
      p_credits,
      p_route,
      p_metadata || jsonb_build_object('bonus_scan', true)
    );

    allowed := true;
    reason := 'bonus';
    daily_used := current_daily;
    monthly_used := current_monthly;
    return next;
    return;
  end if;

  if not within_daily then
    insert into public.usage_ledger (user_id, event_type, credits_used, route, metadata_json)
    values (p_app_user_id, 'rate_limit_block', 0, p_route, p_metadata || '{"reason":"daily_limit"}'::jsonb);

    allowed := false;
    reason := 'daily_limit';
    daily_used := current_daily;
    monthly_used := current_monthly;
    return next;
    return;
  end if;

  insert into public.usage_ledger (user_id, event_type, credits_used, route, metadata_json)
  values (p_app_user_id, 'rate_limit_block', 0, p_route, p_metadata || '{"reason":"monthly_limit"}'::jsonb);

  allowed := false;
  reason := 'monthly_limit';
  daily_used := current_daily;
  monthly_used := current_monthly;
  return next;
end;
$$;


-- ========== 202605200003_early_user_promo.sql ==========
-- Early user promo: first 200 signups receive 50 bonus scans automatically (sync with src/lib/auth/promotions.ts)

alter table public.app_users
  add column if not exists early_promo_number integer;

alter table public.app_users
  drop constraint if exists app_users_early_promo_number_positive;

alter table public.app_users
  add constraint app_users_early_promo_number_positive
  check (early_promo_number is null or early_promo_number > 0);

create unique index if not exists app_users_early_promo_number_key
  on public.app_users (early_promo_number)
  where early_promo_number is not null;

create or replace function public.sync_clerk_user(
  p_clerk_user_id text,
  p_email text,
  p_display_name text,
  p_avatar_url text
)
returns public.app_users
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.app_users;
  next_beta_number integer;
  next_early_promo integer;
  synced public.app_users;
  normalized_email text;
  is_master_admin boolean;
  grant_early_promo boolean := false;
  master_admin_email constant text := 'solarverse2022@gmail.com';
  early_promo_limit constant integer := 200;
  early_promo_bonus constant integer := 50;
begin
  if nullif(trim(p_clerk_user_id), '') is null then
    raise exception 'clerk_user_id is required';
  end if;

  normalized_email := lower(trim(coalesce(p_email, '')));
  is_master_admin := normalized_email = master_admin_email;

  perform pg_advisory_xact_lock(hashtext('pgt_beta_assignment_v1'));

  select * into existing
  from public.app_users
  where clerk_user_id = p_clerk_user_id;

  if found then
    update public.app_users
    set
      email = nullif(trim(p_email), ''),
      display_name = nullif(trim(p_display_name), ''),
      avatar_url = nullif(trim(p_avatar_url), ''),
      deleted_at = null,
      plan = case
        when is_master_admin then 'admin'::public.user_plan
        when existing.plan = 'admin'::public.user_plan then 'trial'::public.user_plan
        else existing.plan
      end,
      last_active_at = coalesce(last_active_at, now())
    where id = existing.id
    returning * into synced;
  else
    select coalesce(max(beta_number), 0) + 1 into next_beta_number
    from public.app_users
    where beta_number is not null;

    select coalesce(max(early_promo_number), 0) into next_early_promo
    from public.app_users
    where early_promo_number is not null;

    grant_early_promo := not is_master_admin and next_early_promo < early_promo_limit;

    insert into public.app_users (
      clerk_user_id,
      email,
      display_name,
      avatar_url,
      plan,
      beta_number,
      bonus_scans,
      early_promo_number,
      last_active_at
    )
    values (
      p_clerk_user_id,
      nullif(trim(p_email), ''),
      nullif(trim(p_display_name), ''),
      nullif(trim(p_avatar_url), ''),
      case
        when is_master_admin then 'admin'::public.user_plan
        when next_beta_number <= 500 then 'beta_pro'::public.user_plan
        else 'trial'::public.user_plan
      end,
      case
        when is_master_admin then null
        when next_beta_number <= 500 then next_beta_number
        else null
      end,
      case when grant_early_promo then early_promo_bonus else 0 end,
      case when grant_early_promo then next_early_promo + 1 else null end,
      now()
    )
    returning * into synced;

    insert into public.profiles (user_id)
    values (synced.id)
    on conflict (user_id) do nothing;
  end if;

  return synced;
end;
$$;

with ranked as (
  select
    id,
    row_number() over (order by created_at asc, id asc) as rn
  from public.app_users
  where deleted_at is null
    and plan <> 'admin'::public.user_plan
)
update public.app_users u
set
  early_promo_number = r.rn,
  bonus_scans = u.bonus_scans + 50
from ranked r
where u.id = r.id
  and r.rn <= 200
  and u.early_promo_number is null;


-- ========== 202605200004_early_user_promo_ledger.sql ==========
-- Promo grant audit event (must commit before use in ledger inserts)

do $$ begin
  alter type public.usage_event_type add value if not exists 'promo_grant';
exception
  when duplicate_object then null;
end $$;


-- ========== 202605200005_early_user_promo_ledger_apply.sql ==========
-- Early user promo ledger + sync audit (run after 202605200004 enum commit)

create or replace function public.sync_clerk_user(
  p_clerk_user_id text,
  p_email text,
  p_display_name text,
  p_avatar_url text
)
returns public.app_users
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.app_users;
  next_beta_number integer;
  next_early_promo integer;
  synced public.app_users;
  normalized_email text;
  is_master_admin boolean;
  grant_early_promo boolean := false;
  master_admin_email constant text := 'solarverse2022@gmail.com';
  early_promo_limit constant integer := 200;
  early_promo_bonus constant integer := 50;
begin
  if nullif(trim(p_clerk_user_id), '') is null then
    raise exception 'clerk_user_id is required';
  end if;

  normalized_email := lower(trim(coalesce(p_email, '')));
  is_master_admin := normalized_email = master_admin_email;

  perform pg_advisory_xact_lock(hashtext('pgt_beta_assignment_v1'));

  select * into existing
  from public.app_users
  where clerk_user_id = p_clerk_user_id;

  if found then
    update public.app_users
    set
      email = nullif(trim(p_email), ''),
      display_name = nullif(trim(p_display_name), ''),
      avatar_url = nullif(trim(p_avatar_url), ''),
      deleted_at = null,
      plan = case
        when is_master_admin then 'admin'::public.user_plan
        when existing.plan = 'admin'::public.user_plan then 'trial'::public.user_plan
        else existing.plan
      end,
      last_active_at = coalesce(last_active_at, now())
    where id = existing.id
    returning * into synced;
  else
    select coalesce(max(beta_number), 0) + 1 into next_beta_number
    from public.app_users
    where beta_number is not null;

    select coalesce(max(early_promo_number), 0) into next_early_promo
    from public.app_users
    where early_promo_number is not null;

    grant_early_promo := not is_master_admin and next_early_promo < early_promo_limit;

    insert into public.app_users (
      clerk_user_id,
      email,
      display_name,
      avatar_url,
      plan,
      beta_number,
      bonus_scans,
      early_promo_number,
      last_active_at
    )
    values (
      p_clerk_user_id,
      nullif(trim(p_email), ''),
      nullif(trim(p_display_name), ''),
      nullif(trim(p_avatar_url), ''),
      case
        when is_master_admin then 'admin'::public.user_plan
        when next_beta_number <= 500 then 'beta_pro'::public.user_plan
        else 'trial'::public.user_plan
      end,
      case
        when is_master_admin then null
        when next_beta_number <= 500 then next_beta_number
        else null
      end,
      case when grant_early_promo then early_promo_bonus else 0 end,
      case when grant_early_promo then next_early_promo + 1 else null end,
      now()
    )
    returning * into synced;

    insert into public.profiles (user_id)
    values (synced.id)
    on conflict (user_id) do nothing;

    if grant_early_promo then
      insert into public.usage_ledger (user_id, event_type, credits_used, route, metadata_json)
      values (
        synced.id,
        'promo_grant',
        0,
        'early_user_promo',
        jsonb_build_object(
          'promo_id', 'early_user_2026',
          'credits_granted', early_promo_bonus,
          'early_promo_number', synced.early_promo_number
        )
      );
    end if;
  end if;

  return synced;
end;
$$;

insert into public.usage_ledger (user_id, event_type, credits_used, route, metadata_json)
select
  u.id,
  'promo_grant',
  0,
  'early_user_promo_backfill',
  jsonb_build_object(
    'promo_id', 'early_user_2026',
    'credits_granted', 50,
    'early_promo_number', u.early_promo_number
  )
from public.app_users u
where u.early_promo_number is not null
  and u.early_promo_number <= 200
  and not exists (
    select 1
    from public.usage_ledger ul
    where ul.user_id = u.id
      and ul.event_type = 'promo_grant'
      and ul.route in ('early_user_promo', 'early_user_promo_backfill')
  );


-- ========== 202605200006_early_user_promo_bonus_50.sql ==========
-- Bump early adopter promo from 20 → 50 bonus scans (sync with src/lib/auth/promotions.ts)

create or replace function public.sync_clerk_user(
  p_clerk_user_id text,
  p_email text,
  p_display_name text,
  p_avatar_url text
)
returns public.app_users
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.app_users;
  next_beta_number integer;
  next_early_promo integer;
  synced public.app_users;
  normalized_email text;
  is_master_admin boolean;
  grant_early_promo boolean := false;
  master_admin_email constant text := 'solarverse2022@gmail.com';
  early_promo_limit constant integer := 200;
  early_promo_bonus constant integer := 50;
begin
  if nullif(trim(p_clerk_user_id), '') is null then
    raise exception 'clerk_user_id is required';
  end if;

  normalized_email := lower(trim(coalesce(p_email, '')));
  is_master_admin := normalized_email = master_admin_email;

  perform pg_advisory_xact_lock(hashtext('pgt_beta_assignment_v1'));

  select * into existing
  from public.app_users
  where clerk_user_id = p_clerk_user_id;

  if found then
    update public.app_users
    set
      email = nullif(trim(p_email), ''),
      display_name = nullif(trim(p_display_name), ''),
      avatar_url = nullif(trim(p_avatar_url), ''),
      deleted_at = null,
      plan = case
        when is_master_admin then 'admin'::public.user_plan
        when existing.plan = 'admin'::public.user_plan then 'trial'::public.user_plan
        else existing.plan
      end,
      last_active_at = coalesce(last_active_at, now())
    where id = existing.id
    returning * into synced;
  else
    select coalesce(max(beta_number), 0) + 1 into next_beta_number
    from public.app_users
    where beta_number is not null;

    select coalesce(max(early_promo_number), 0) into next_early_promo
    from public.app_users
    where early_promo_number is not null;

    grant_early_promo := not is_master_admin and next_early_promo < early_promo_limit;

    insert into public.app_users (
      clerk_user_id,
      email,
      display_name,
      avatar_url,
      plan,
      beta_number,
      bonus_scans,
      early_promo_number,
      last_active_at
    )
    values (
      p_clerk_user_id,
      nullif(trim(p_email), ''),
      nullif(trim(p_display_name), ''),
      nullif(trim(p_avatar_url), ''),
      case
        when is_master_admin then 'admin'::public.user_plan
        when next_beta_number <= 500 then 'beta_pro'::public.user_plan
        else 'trial'::public.user_plan
      end,
      case
        when is_master_admin then null
        when next_beta_number <= 500 then next_beta_number
        else null
      end,
      case when grant_early_promo then early_promo_bonus else 0 end,
      case when grant_early_promo then next_early_promo + 1 else null end,
      now()
    )
    returning * into synced;

    insert into public.profiles (user_id)
    values (synced.id)
    on conflict (user_id) do nothing;

    if grant_early_promo then
      insert into public.usage_ledger (user_id, event_type, credits_used, route, metadata_json)
      values (
        synced.id,
        'promo_grant',
        0,
        'early_user_promo',
        jsonb_build_object(
          'promo_id', 'early_user_2026',
          'credits_granted', early_promo_bonus,
          'early_promo_number', synced.early_promo_number
        )
      );
    end if;
  end if;

  return synced;
end;
$$;

-- Top up existing early adopters who received the original 20-scan grant
update public.app_users u
set bonus_scans = u.bonus_scans + 30
where u.early_promo_number is not null
  and u.early_promo_number <= 200
  and exists (
    select 1
    from public.usage_ledger ul
    where ul.user_id = u.id
      and ul.route in ('early_user_promo', 'early_user_promo_backfill')
      and coalesce((ul.metadata_json->>'credits_granted')::integer, 0) = 20
  )
  and not exists (
    select 1
    from public.usage_ledger ul
    where ul.user_id = u.id
      and ul.route = 'early_user_promo_topup_50'
  );

insert into public.usage_ledger (user_id, event_type, credits_used, route, metadata_json)
select
  u.id,
  'promo_grant',
  0,
  'early_user_promo_topup_50',
  jsonb_build_object(
    'promo_id', 'early_user_2026',
    'credits_granted', 30,
    'previous_grant', 20,
    'new_total_grant', 50,
    'early_promo_number', u.early_promo_number
  )
from public.app_users u
where u.early_promo_number is not null
  and u.early_promo_number <= 200
  and exists (
    select 1
    from public.usage_ledger ul
    where ul.user_id = u.id
      and ul.route in ('early_user_promo', 'early_user_promo_backfill')
      and coalesce((ul.metadata_json->>'credits_granted')::integer, 0) = 20
  )
  and not exists (
    select 1
    from public.usage_ledger ul
    where ul.user_id = u.id
      and ul.route = 'early_user_promo_topup_50'
  );


-- ========== 202605210001_market_snapshots.sql ==========
-- Market history foundation for scanner research.
-- Stores normalized FMV/evidence snapshots by identity hash + grade bucket.

create table if not exists public.market_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.app_users(id) on delete set null,
  session_id uuid references public.scan_sessions(id) on delete set null,
  extracted_card_id uuid references public.extracted_cards(id) on delete set null,
  identity_hash text not null,
  franchise text,
  card_name text not null,
  set_name text,
  card_number text,
  year text,
  variant_label text,
  grade_bucket text not null default 'raw',
  fmv_usd numeric(12, 2),
  fmv_basis text,
  confidence numeric(5, 4) not null default 0,
  sold_count integer not null default 0,
  active_count integer not null default 0,
  reference_count integer not null default 0,
  auction_count integer not null default 0,
  buy_now_count integer not null default 0,
  evidence_json jsonb not null default '[]'::jsonb,
  bucket_summary_json jsonb not null default '[]'::jsonb,
  source_summary_json jsonb not null default '[]'::jsonb,
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists market_snapshots_identity_bucket_captured_idx
  on public.market_snapshots(identity_hash, grade_bucket, captured_at desc);

create index if not exists market_snapshots_user_captured_idx
  on public.market_snapshots(user_id, captured_at desc);

create index if not exists market_snapshots_card_lookup_idx
  on public.market_snapshots(franchise, card_name, set_name, card_number);

alter table public.market_snapshots enable row level security;

drop policy if exists "Users can read own market snapshots" on public.market_snapshots;
create policy "Users can read own market snapshots"
on public.market_snapshots
for select
using (
  user_id in (
    select id from public.app_users where clerk_user_id = auth.jwt() ->> 'sub'
  )
);

drop policy if exists "Service role can manage market snapshots" on public.market_snapshots;
create policy "Service role can manage market snapshots"
on public.market_snapshots
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');



-- ========== 202605220001_tcg_catalog.sql ==========
-- Unified TCG / sports catalog cache (synced from official/community APIs).
-- Runtime scan matching uses live APIs first; DB accelerates search and offline browse.

create table if not exists public.tcg_catalog_sources (
  id text primary key,
  franchise text not null,
  label text not null,
  api_base_url text,
  license_notes text,
  sync_enabled boolean not null default true,
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.tcg_catalog_sets (
  id uuid primary key default gen_random_uuid(),
  franchise text not null,
  external_set_id text not null,
  name text not null,
  code text,
  release_date date,
  card_count integer,
  source_id text references public.tcg_catalog_sources(id) on delete set null,
  raw_json jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  unique (franchise, external_set_id)
);

create index if not exists tcg_catalog_sets_franchise_idx
  on public.tcg_catalog_sets (franchise, name);

create table if not exists public.tcg_catalog_cards (
  id uuid primary key default gen_random_uuid(),
  franchise text not null,
  catalog_id text not null,
  name text not null,
  printed_name text,
  set_name text,
  set_code text,
  card_number text,
  year text,
  rarity text,
  image_small_url text,
  image_large_url text,
  search_text text not null default '',
  prices_json jsonb not null default '{}'::jsonb,
  raw_json jsonb not null default '{}'::jsonb,
  source_id text references public.tcg_catalog_sources(id) on delete set null,
  synced_at timestamptz not null default now(),
  unique (franchise, catalog_id)
);

create index if not exists tcg_catalog_cards_franchise_name_idx
  on public.tcg_catalog_cards (franchise, lower(name));

create index if not exists tcg_catalog_cards_franchise_number_idx
  on public.tcg_catalog_cards (franchise, card_number)
  where card_number is not null;

create index if not exists tcg_catalog_cards_search_idx
  on public.tcg_catalog_cards using gin (to_tsvector('english', search_text));

insert into public.tcg_catalog_sources (id, franchise, label, api_base_url, license_notes, sync_enabled)
values
  ('pokemontcg.io', 'pokemon', 'Pokemon TCG API', 'https://api.pokemontcg.io/v2', 'Pokemon TCG API terms; optional API key', true),
  ('scryfall.com', 'magic', 'Scryfall', 'https://api.scryfall.com', 'Wizards Fan Content Policy; cache 24h+', true),
  ('ygoprodeck.com', 'yugioh', 'YGOPRODeck', 'https://db.ygoprodeck.com/api/v7', 'Free; store locally per API guide', true),
  ('optcgapi.com', 'onepiece', 'OPTCG API', 'https://optcgapi.com/api', 'Consumption-only GET; be rate-conscious', true),
  ('lorcast.com', 'lorcana', 'Lorcast', 'https://api.lorcast.com/v0', 'Beta API; cache 24h+', true),
  ('apitcg.com', 'dragonball', 'Api TCG (Dragon Ball FW)', 'https://apitcg.com/api', 'API key required for production sync', true),
  ('pricecharting.com', 'sports', 'PriceCharting (sports)', 'https://www.pricecharting.com', 'Web/market comps; sparse catalog seed', false)
on conflict (id) do update set
  label = excluded.label,
  api_base_url = excluded.api_base_url,
  license_notes = excluded.license_notes;

comment on table public.tcg_catalog_cards is 'Cached catalog rows keyed by franchise + external catalog_id';
comment on column public.tcg_catalog_cards.search_text is 'Lowercased name/set/number blob for full-text and ilike search';


-- ========== 202605230001_pgt_registry.sql ==========
-- PGT Registry Phase 1: canonical card identities, slab cert cache, observation log.

create table if not exists public.pgt_card_identities (
  id uuid primary key default gen_random_uuid(),
  identity_hash text not null,
  franchise text not null default 'pokemon',
  canonical_name text not null,
  set_name text,
  card_number text,
  year text,
  variant_key text,
  lane text not null default 'raw' check (lane in ('raw', 'graded')),
  grader text,
  grade text,
  cert_number text,
  catalog_id text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  observation_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pgt_card_identities_hash_unique unique (identity_hash)
);

create index if not exists pgt_card_identities_franchise_name_idx
  on public.pgt_card_identities (franchise, lower(canonical_name));

create index if not exists pgt_card_identities_cert_idx
  on public.pgt_card_identities (grader, cert_number)
  where cert_number is not null;

create table if not exists public.pgt_slab_registry (
  id uuid primary key default gen_random_uuid(),
  grader text not null,
  cert_number text not null,
  pgt_card_identity_id uuid references public.pgt_card_identities(id) on delete set null,
  provider text,
  registry_json jsonb not null default '{}'::jsonb,
  population_note text,
  grade_date text,
  gemrate_id text,
  registry_url text,
  is_verified boolean not null default false,
  refreshed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pgt_slab_registry_grader_cert_unique unique (grader, cert_number)
);

create index if not exists pgt_slab_registry_identity_idx
  on public.pgt_slab_registry (pgt_card_identity_id);

create index if not exists pgt_slab_registry_refreshed_idx
  on public.pgt_slab_registry (refreshed_at desc);

create table if not exists public.pgt_card_observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.app_users(id) on delete set null,
  pgt_card_identity_id uuid references public.pgt_card_identities(id) on delete set null,
  session_id uuid references public.scan_sessions(id) on delete set null,
  extracted_card_id uuid references public.extracted_cards(id) on delete set null,
  event_type text not null check (
    event_type in (
      'session_save',
      'registry_hydrate',
      'enrich_complete',
      'user_confirm',
      'user_reject',
      'user_edit'
    )
  ),
  catalog_identity_status text,
  confidence numeric(5, 4),
  fmv_usd numeric(12, 2),
  grade_bucket text,
  provider text,
  payload_json jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists pgt_card_observations_user_observed_idx
  on public.pgt_card_observations (user_id, observed_at desc);

create index if not exists pgt_card_observations_identity_idx
  on public.pgt_card_observations (pgt_card_identity_id, observed_at desc);

create index if not exists pgt_card_observations_event_idx
  on public.pgt_card_observations (event_type, observed_at desc);

alter table public.extracted_cards
  add column if not exists pgt_card_identity_id uuid references public.pgt_card_identities(id) on delete set null;

create index if not exists extracted_cards_pgt_identity_idx
  on public.extracted_cards (pgt_card_identity_id)
  where pgt_card_identity_id is not null;

drop trigger if exists pgt_card_identities_touch_updated_at on public.pgt_card_identities;
create trigger pgt_card_identities_touch_updated_at
before update on public.pgt_card_identities
for each row execute function public.touch_updated_at();

drop trigger if exists pgt_slab_registry_touch_updated_at on public.pgt_slab_registry;
create trigger pgt_slab_registry_touch_updated_at
before update on public.pgt_slab_registry
for each row execute function public.touch_updated_at();

alter table public.pgt_card_identities enable row level security;
alter table public.pgt_slab_registry enable row level security;
alter table public.pgt_card_observations enable row level security;

drop policy if exists "Service role manages pgt_card_identities" on public.pgt_card_identities;
create policy "Service role manages pgt_card_identities"
on public.pgt_card_identities for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "Service role manages pgt_slab_registry" on public.pgt_slab_registry;
create policy "Service role manages pgt_slab_registry"
on public.pgt_slab_registry for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "Users read own pgt_card_observations" on public.pgt_card_observations;
create policy "Users read own pgt_card_observations"
on public.pgt_card_observations for select
using (
  user_id in (
    select id from public.app_users where clerk_user_id = auth.jwt() ->> 'sub'
  )
);

drop policy if exists "Service role manages pgt_card_observations" on public.pgt_card_observations;
create policy "Service role manages pgt_card_observations"
on public.pgt_card_observations for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

comment on table public.pgt_card_identities is 'Canonical PGT card identity (raw or graded) keyed by identity_hash';
comment on table public.pgt_slab_registry is 'Cached grader cert lookups (PSA/CGC/BGS) with population snapshots';
comment on table public.pgt_card_observations is 'Append-only timeline of extractions, enrich, registry, and user actions';


-- ========== 202605260001_companion_starter_rerolls.sql ==========
alter table public.user_companions
  add column if not exists starter_rerolls_used integer not null default 0;

alter table public.user_companions
  drop constraint if exists user_companions_starter_rerolls_cap;

alter table public.user_companions
  add constraint user_companions_starter_rerolls_cap check (
    starter_rerolls_used >= 0 and starter_rerolls_used <= 3
  );


-- ========== 202605270001_tcg_catalog_lookup_indexes.sql ==========
-- Speed up scan-time catalog lookups (set + number).
-- Safe to re-run due to IF NOT EXISTS.

create index if not exists tcg_catalog_cards_franchise_setcode_number_idx
  on public.tcg_catalog_cards (franchise, set_code, card_number);

create extension if not exists pg_trgm;

create index if not exists tcg_catalog_cards_franchise_number_name_idx
  on public.tcg_catalog_cards (franchise, card_number, lower(name));

create index if not exists tcg_catalog_cards_name_trgm_idx
  on public.tcg_catalog_cards using gin (name gin_trgm_ops);

create index if not exists tcg_catalog_cards_set_name_trgm_idx
  on public.tcg_catalog_cards using gin (set_name gin_trgm_ops);


-- ========== 202605280001_pgt_market_intel.sql ==========
-- Phase B — shared market intelligence (Pokémon-first; other franchises follow).
-- Comps and population snapshots are written by enrich/workers in later PRs.

create table if not exists public.pgt_certifications (
  id uuid primary key default gen_random_uuid(),
  grader text not null,
  cert_number text not null,
  catalog_id text,
  franchise text not null default 'pokemon',
  pgt_card_identity_id uuid references public.pgt_card_identities(id) on delete set null,
  gemrate_id text,
  grade text,
  card_name text,
  set_name text,
  card_number text,
  registry_url text,
  provider text,
  registry_json jsonb not null default '{}'::jsonb,
  verified_at timestamptz,
  refreshed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pgt_certifications_grader_cert_unique unique (grader, cert_number)
);

create index if not exists pgt_certifications_catalog_idx
  on public.pgt_certifications (catalog_id)
  where catalog_id is not null;

create table if not exists public.pgt_population_snapshots (
  id uuid primary key default gen_random_uuid(),
  catalog_id text not null,
  franchise text not null default 'pokemon',
  grader text not null,
  grade text,
  population_count integer,
  population_higher integer,
  population_note text,
  source text,
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists pgt_population_snapshots_catalog_grader_idx
  on public.pgt_population_snapshots (catalog_id, grader, captured_at desc);

create table if not exists public.pgt_market_comps (
  id uuid primary key default gen_random_uuid(),
  catalog_id text not null,
  franchise text not null default 'pokemon',
  grade_bucket text,
  kind text not null check (kind in ('sold', 'active', 'reference')),
  title text not null,
  price_usd numeric(12, 2),
  observed_at date,
  url text,
  source text,
  slab text,
  identity_hash text,
  ingested_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Prevent comp table blow-up: avoid duplicates for the same catalog + evidence key.
create unique index if not exists pgt_market_comps_dedupe_idx
  on public.pgt_market_comps (
    catalog_id,
    grade_bucket,
    kind,
    url,
    price_usd,
    observed_at,
    source,
    identity_hash
  );

create index if not exists pgt_market_comps_catalog_observed_idx
  on public.pgt_market_comps (catalog_id, observed_at desc nulls last);

create index if not exists pgt_market_comps_catalog_grade_idx
  on public.pgt_market_comps (catalog_id, grade_bucket, kind);

comment on table public.pgt_certifications is 'Phase B cert spine keyed to catalog_id (Pokémon-first).';
comment on table public.pgt_population_snapshots is 'Time-series grader population by catalog_id.';
comment on table public.pgt_market_comps is 'Shared historical comps for market card pages and FMV.';

alter table public.pgt_certifications enable row level security;
alter table public.pgt_population_snapshots enable row level security;
alter table public.pgt_market_comps enable row level security;

-- Service role writes; authenticated read for market pages (Phase C).
create policy pgt_market_comps_read_authenticated
  on public.pgt_market_comps for select
  to authenticated
  using (true);

create policy pgt_population_snapshots_read_authenticated
  on public.pgt_population_snapshots for select
  to authenticated
  using (true);

create policy pgt_certifications_read_authenticated
  on public.pgt_certifications for select
  to authenticated
  using (true);


-- ========== 202605280002_tcg_catalog_localized_artwork.sql ==========
-- Localized catalog artwork overlay.
-- Keeps language-specific images separate from the canonical tcg_catalog_cards spine.

create table if not exists public.tcg_catalog_localized_artwork (
  id uuid primary key default gen_random_uuid(),
  franchise text not null,
  base_catalog_id text not null,
  language text not null,
  localized_catalog_id text not null default '',
  localized_set_code text,
  localized_set_name text,
  localized_name text,
  printed_number text not null default '',
  counterpart_number text,
  image_small_url text,
  image_large_url text,
  artwork_match_status text not null default 'needs_image_review'
    check (artwork_match_status in (
      'exact_japanese_print',
      'same_art_confirmed',
      'english_fallback',
      'needs_image_review'
    )),
  match_method text not null default 'manual_review'
    check (match_method in (
      'exact_localized_id',
      'set_number_match',
      'curated_mapping',
      'tcgdex_alias',
      'english_counterpart_fallback',
      'manual_review'
    )),
  match_confidence numeric not null default 0
    check (match_confidence >= 0 and match_confidence <= 1),
  source text not null,
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (franchise, base_catalog_id, language, localized_catalog_id, printed_number)
);

create index if not exists tcg_catalog_localized_artwork_lookup_idx
  on public.tcg_catalog_localized_artwork (franchise, base_catalog_id, lower(language), printed_number);

create index if not exists tcg_catalog_localized_artwork_source_idx
  on public.tcg_catalog_localized_artwork (source, localized_catalog_id)
  where localized_catalog_id is not null;

comment on table public.tcg_catalog_localized_artwork is
  'Language-specific artwork overlay linked to canonical tcg_catalog_cards rows. Does not replace base catalog images.';

comment on column public.tcg_catalog_localized_artwork.base_catalog_id is
  'Canonical tcg_catalog_cards.catalog_id, e.g. base1-4.';

comment on column public.tcg_catalog_localized_artwork.artwork_match_status is
  'exact_japanese_print/same_art_confirmed/english_fallback/needs_image_review; controls whether the scanner may trust the image.';


-- ========== 202605280003_tcg_catalog_set_insights.sql ==========
-- Cached Master Catalog set insight payloads (full-set rollups + optional AI narrative).
-- Keyed by franchise + set_id; refreshed by /api/catalog/set-insight and nightly catalog jobs.

create table if not exists public.tcg_catalog_set_insights (
  franchise text not null default 'pokemon',
  set_id text not null,
  payload jsonb not null,
  source text,
  model text,
  ready boolean not null default false,
  refreshed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (franchise, set_id)
);

create index if not exists tcg_catalog_set_insights_refreshed_idx
  on public.tcg_catalog_set_insights (refreshed_at desc);

