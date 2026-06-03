-- PGT-owned US market price spine for 7d/30d trends (TCGPlayer anchors + ingest).

create table if not exists public.pgt_us_price_ticks (
  id uuid primary key default gen_random_uuid(),
  catalog_id text not null,
  franchise text not null default 'pokemon',
  price_usd numeric(12, 2) not null,
  lane text not null default 'tcgplayer_market'
    check (lane in ('tcgplayer_market', 'sold_median', 'reference', 'blended')),
  captured_on date not null default (timezone('utc', now()))::date,
  created_at timestamptz not null default now()
);

create unique index if not exists pgt_us_price_ticks_catalog_day_lane_uidx
  on public.pgt_us_price_ticks (catalog_id, captured_on, lane);

create index if not exists pgt_us_price_ticks_catalog_captured_idx
  on public.pgt_us_price_ticks (catalog_id, captured_on desc);

comment on table public.pgt_us_price_ticks is
  'Daily US price anchors per catalog card — powers PGT 7d vs 30d trends without third-party rate limits.';

alter table public.pgt_us_price_ticks enable row level security;

create policy pgt_us_price_ticks_read_authenticated
  on public.pgt_us_price_ticks for select
  to authenticated
  using (true);

create policy pgt_us_price_ticks_service_role
  on public.pgt_us_price_ticks for all
  to service_role
  using (true)
  with check (true);
