-- Unified TCG / sports catalog cache (synced from official/community APIs).
-- Runtime scan matching uses live APIs first; DB accelerates search and offline browse.

create table if not exists public.tcg_catalog_sources (
  id text primary key,
  franchise text not null,
  label text not null,
  api_base_url text,
  license_notes text,
  sync_enabled boolean not null default true,
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.tcg_catalog_sets (
  id uuid primary key default gen_random_uuid(),
  franchise text not null,
  external_set_id text not null,
  name text not null,
  code text,
  release_date date,
  card_count integer,
  source_id text references public.tcg_catalog_sources(id) on delete set null,
  raw_json jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  unique (franchise, external_set_id)
);

create index if not exists tcg_catalog_sets_franchise_idx
  on public.tcg_catalog_sets (franchise, name);

create table if not exists public.tcg_catalog_cards (
  id uuid primary key default gen_random_uuid(),
  franchise text not null,
  catalog_id text not null,
  name text not null,
  printed_name text,
  set_name text,
  set_code text,
  card_number text,
  year text,
  rarity text,
  image_small_url text,
  image_large_url text,
  search_text text not null default '',
  prices_json jsonb not null default '{}'::jsonb,
  raw_json jsonb not null default '{}'::jsonb,
  source_id text references public.tcg_catalog_sources(id) on delete set null,
  synced_at timestamptz not null default now(),
  unique (franchise, catalog_id)
);

create index if not exists tcg_catalog_cards_franchise_name_idx
  on public.tcg_catalog_cards (franchise, lower(name));

create index if not exists tcg_catalog_cards_franchise_number_idx
  on public.tcg_catalog_cards (franchise, card_number)
  where card_number is not null;

create index if not exists tcg_catalog_cards_search_idx
  on public.tcg_catalog_cards using gin (to_tsvector('english', search_text));

insert into public.tcg_catalog_sources (id, franchise, label, api_base_url, license_notes, sync_enabled)
values
  ('pokemontcg.io', 'pokemon', 'Pokemon TCG API', 'https://api.pokemontcg.io/v2', 'Pokemon TCG API terms; optional API key', true),
  ('scryfall.com', 'magic', 'Scryfall', 'https://api.scryfall.com', 'Wizards Fan Content Policy; cache 24h+', true),
  ('ygoprodeck.com', 'yugioh', 'YGOPRODeck', 'https://db.ygoprodeck.com/api/v7', 'Free; store locally per API guide', true),
  ('optcgapi.com', 'onepiece', 'OPTCG API', 'https://optcgapi.com/api', 'Consumption-only GET; be rate-conscious', true),
  ('lorcast.com', 'lorcana', 'Lorcast', 'https://api.lorcast.com/v0', 'Beta API; cache 24h+', true),
  ('apitcg.com', 'dragonball', 'Api TCG (Dragon Ball FW)', 'https://apitcg.com/api', 'API key required for production sync', true),
  ('pricecharting.com', 'sports', 'PriceCharting (sports)', 'https://www.pricecharting.com', 'Web/market comps; sparse catalog seed', false)
on conflict (id) do update set
  label = excluded.label,
  api_base_url = excluded.api_base_url,
  license_notes = excluded.license_notes;

comment on table public.tcg_catalog_cards is 'Cached catalog rows keyed by franchise + external catalog_id';
comment on column public.tcg_catalog_cards.search_text is 'Lowercased name/set/number blob for full-text and ilike search';
