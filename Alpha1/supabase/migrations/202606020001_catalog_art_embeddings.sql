-- Cached art embeddings for visual catalog matching (crop → vector → shortlist).
-- Populated lazily at scan time and via scripts/backfill-catalog-art-embeddings.mjs.

create table if not exists public.tcg_catalog_art_embeddings (
  id uuid primary key default gen_random_uuid(),
  franchise text not null,
  catalog_id text not null,
  model text not null default 'gemini-embedding-001',
  dimensions integer not null default 768,
  embedding jsonb not null,
  image_url text,
  synced_at timestamptz not null default now(),
  unique (franchise, catalog_id, model)
);

create index if not exists tcg_catalog_art_embeddings_franchise_catalog_idx
  on public.tcg_catalog_art_embeddings (franchise, catalog_id);

comment on table public.tcg_catalog_art_embeddings is
  'Gemini image embeddings for tcg_catalog_cards rows; used for art-first disambiguation.';
