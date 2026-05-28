-- Cached Master Catalog set insight payloads (full-set rollups + optional AI narrative).
-- Keyed by franchise + set_id; refreshed by /api/catalog/set-insight and nightly catalog jobs.

create table if not exists public.tcg_catalog_set_insights (
  franchise text not null default 'pokemon',
  set_id text not null,
  payload jsonb not null,
  source text,
  model text,
  ready boolean not null default false,
  refreshed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (franchise, set_id)
);

create index if not exists tcg_catalog_set_insights_refreshed_idx
  on public.tcg_catalog_set_insights (refreshed_at desc);
