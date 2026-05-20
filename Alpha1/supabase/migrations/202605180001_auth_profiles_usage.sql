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
