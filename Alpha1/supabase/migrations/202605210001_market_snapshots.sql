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

