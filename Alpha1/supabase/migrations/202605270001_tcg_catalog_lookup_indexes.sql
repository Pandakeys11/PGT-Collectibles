-- Speed up scan-time catalog lookups (set + number).
-- Safe to re-run due to IF NOT EXISTS.

create index if not exists tcg_catalog_cards_franchise_setcode_number_idx
  on public.tcg_catalog_cards (franchise, set_code, card_number);

create extension if not exists pg_trgm;

create index if not exists tcg_catalog_cards_franchise_number_name_idx
  on public.tcg_catalog_cards (franchise, card_number, lower(name));

create index if not exists tcg_catalog_cards_name_trgm_idx
  on public.tcg_catalog_cards using gin (name gin_trgm_ops);

create index if not exists tcg_catalog_cards_set_name_trgm_idx
  on public.tcg_catalog_cards using gin (set_name gin_trgm_ops);
