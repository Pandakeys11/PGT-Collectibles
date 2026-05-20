-- Early user promo: first 200 signups receive 20 bonus scans automatically (sync with src/lib/auth/promotions.ts)

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
  early_promo_bonus constant integer := 20;
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
  bonus_scans = u.bonus_scans + 20
from ranked r
where u.id = r.id
  and r.rn <= 200
  and u.early_promo_number is null;
