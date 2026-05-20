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
