-- Master catalog digital binder — per-user owned cards by set (set tracker).
-- Applied via: npm run db:apply  OR  npm run db:apply:binder-tracker

create table if not exists public.catalog_binder_owned_cards (
  user_id uuid not null references public.app_users(id) on delete cascade,
  set_id text not null,
  catalog_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, catalog_id)
);

create index if not exists catalog_binder_owned_cards_user_set_idx
  on public.catalog_binder_owned_cards (user_id, set_id);

create index if not exists catalog_binder_owned_cards_set_catalog_idx
  on public.catalog_binder_owned_cards (set_id, catalog_id);

drop trigger if exists catalog_binder_owned_cards_touch_updated_at on public.catalog_binder_owned_cards;
create trigger catalog_binder_owned_cards_touch_updated_at
before update on public.catalog_binder_owned_cards
for each row execute function public.touch_updated_at();

comment on table public.catalog_binder_owned_cards is
  'Master catalog binder set tracker — cards marked owned per user/set.';

alter table public.catalog_binder_owned_cards enable row level security;

-- Refresh PostgREST schema cache (Supabase API) after DDL
notify pgrst, 'reload schema';
