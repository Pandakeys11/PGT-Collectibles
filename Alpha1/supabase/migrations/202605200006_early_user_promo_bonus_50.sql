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
