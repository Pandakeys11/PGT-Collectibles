-- Slabz Partner API — per-user Solana wallet + rip history (Clerk → app_users)

create table if not exists public.user_slabz_wallets (
  user_id uuid primary key references public.app_users(id) on delete cascade,
  wallet_address text not null,
  network text not null default 'devnet',
  updated_at timestamptz not null default now()
);

create table if not exists public.user_slabz_rips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  slabz_transaction_id uuid not null,
  pack_id text not null,
  pack_name text,
  status text not null default 'created',
  wallet_address text not null,
  price_cents integer,
  card jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_slabz_rips_tx_unique unique (slabz_transaction_id)
);

create index if not exists user_slabz_rips_user_created_idx
  on public.user_slabz_rips (user_id, created_at desc);

alter table public.user_slabz_wallets enable row level security;
alter table public.user_slabz_rips enable row level security;

drop policy if exists "Service role manages user_slabz_wallets" on public.user_slabz_wallets;
create policy "Service role manages user_slabz_wallets"
on public.user_slabz_wallets for all
using (true) with check (true);

drop policy if exists "Service role manages user_slabz_rips" on public.user_slabz_rips;
create policy "Service role manages user_slabz_rips"
on public.user_slabz_rips for all
using (true) with check (true);

comment on table public.user_slabz_wallets is 'Linked Solana wallet for Slabz mystery pack rips (per Clerk user)';
comment on table public.user_slabz_rips is 'Cached Slabz pack purchase/open history for Liquid Scan partner panel';
