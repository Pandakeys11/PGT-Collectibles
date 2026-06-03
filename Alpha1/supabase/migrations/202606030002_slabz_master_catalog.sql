-- Slabz partner assets + master catalog source registration

insert into public.tcg_catalog_sources (id, franchise, label, api_base_url, license_notes, sync_enabled)
values (
  'slabz.com',
  'sports',
  'Slabz Partner API',
  'https://api-docs.slabz.com/',
  'Graded slab NFTs from mystery pack rips; SLABZ_API_KEY required',
  true
)
on conflict (id) do update set
  label = excluded.label,
  api_base_url = excluded.api_base_url,
  license_notes = excluded.license_notes,
  sync_enabled = excluded.sync_enabled;

create table if not exists public.pgt_slabz_assets (
  id uuid primary key default gen_random_uuid(),
  nft_mint text not null,
  slabz_transaction_id uuid,
  pack_id text,
  name text not null,
  category text,
  grade text,
  grading_company text,
  serial_number text,
  insured_value_cents integer,
  image_front_url text,
  image_back_url text,
  catalog_id text,
  raw_json jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  constraint pgt_slabz_assets_nft_unique unique (nft_mint)
);

create index if not exists pgt_slabz_assets_pack_idx on public.pgt_slabz_assets (pack_id);
create index if not exists pgt_slabz_assets_catalog_idx on public.pgt_slabz_assets (catalog_id);

alter table public.pgt_slabz_assets enable row level security;

drop policy if exists "Service role manages pgt_slabz_assets" on public.pgt_slabz_assets;
create policy "Service role manages pgt_slabz_assets"
on public.pgt_slabz_assets for all
using (true) with check (true);

comment on table public.pgt_slabz_assets is 'Slabz graded slab images + metadata synced from Partner API transactions';
