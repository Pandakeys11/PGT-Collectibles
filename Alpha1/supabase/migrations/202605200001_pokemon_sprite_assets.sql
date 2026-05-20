-- Master Pokémon sprite catalog (Option B).
-- Safe to apply on existing projects: new table only, no changes to scan/companion tables.
-- Populate via scripts/sync-companion-sprites-storage.mjs or future PGT Market sync.

create table if not exists public.pokemon_sprite_assets (
  national_id integer primary key,
  showdown_slug text not null,
  has_ani boolean not null default false,
  has_artwork boolean not null default false,
  ani_storage_path text,
  artwork_storage_path text,
  ani_public_url text,
  artwork_public_url text,
  source text not null default 'showdown',
  metadata_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists pokemon_sprite_assets_slug_idx
  on public.pokemon_sprite_assets (showdown_slug);

comment on table public.pokemon_sprite_assets is
  'Hosted sprite manifest for companion/battle UI. Sync from Showdown upload or PGT Market master DB.';

alter table public.pokemon_sprite_assets enable row level security;

-- Public read for CDN URLs (no write from client)
drop policy if exists pokemon_sprite_assets_public_read on public.pokemon_sprite_assets;
create policy pokemon_sprite_assets_public_read
  on public.pokemon_sprite_assets
  for select
  to anon, authenticated
  using (true);
