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
