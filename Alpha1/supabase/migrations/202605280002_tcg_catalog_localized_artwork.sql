-- Localized catalog artwork overlay.
-- Keeps language-specific images separate from the canonical tcg_catalog_cards spine.

create table if not exists public.tcg_catalog_localized_artwork (
  id uuid primary key default gen_random_uuid(),
  franchise text not null,
  base_catalog_id text not null,
  language text not null,
  localized_catalog_id text not null default '',
  localized_set_code text,
  localized_set_name text,
  localized_name text,
  printed_number text not null default '',
  counterpart_number text,
  image_small_url text,
  image_large_url text,
  artwork_match_status text not null default 'needs_image_review'
    check (artwork_match_status in (
      'exact_japanese_print',
      'same_art_confirmed',
      'english_fallback',
      'needs_image_review'
    )),
  match_method text not null default 'manual_review'
    check (match_method in (
      'exact_localized_id',
      'set_number_match',
      'curated_mapping',
      'tcgdex_alias',
      'english_counterpart_fallback',
      'manual_review'
    )),
  match_confidence numeric not null default 0
    check (match_confidence >= 0 and match_confidence <= 1),
  source text not null,
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (franchise, base_catalog_id, language, localized_catalog_id, printed_number)
);

create index if not exists tcg_catalog_localized_artwork_lookup_idx
  on public.tcg_catalog_localized_artwork (franchise, base_catalog_id, lower(language), printed_number);

create index if not exists tcg_catalog_localized_artwork_source_idx
  on public.tcg_catalog_localized_artwork (source, localized_catalog_id)
  where localized_catalog_id is not null;

comment on table public.tcg_catalog_localized_artwork is
  'Language-specific artwork overlay linked to canonical tcg_catalog_cards rows. Does not replace base catalog images.';

comment on column public.tcg_catalog_localized_artwork.base_catalog_id is
  'Canonical tcg_catalog_cards.catalog_id, e.g. base1-4.';

comment on column public.tcg_catalog_localized_artwork.artwork_match_status is
  'exact_japanese_print/same_art_confirmed/english_fallback/needs_image_review; controls whether the scanner may trust the image.';
