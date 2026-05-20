-- AUTO-GENERATED — pending migrations bundle
-- Run once in Supabase SQL Editor, then: npm run db:verify
-- Regenerate: node scripts/build-pending-sql.mjs

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

