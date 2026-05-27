-- Phase B — shared market intelligence (Pokémon-first; other franchises follow).
-- Comps and population snapshots are written by enrich/workers in later PRs.

create table if not exists public.pgt_certifications (
  id uuid primary key default gen_random_uuid(),
  grader text not null,
  cert_number text not null,
  catalog_id text,
  franchise text not null default 'pokemon',
  pgt_card_identity_id uuid references public.pgt_card_identities(id) on delete set null,
  gemrate_id text,
  grade text,
  card_name text,
  set_name text,
  card_number text,
  registry_url text,
  provider text,
  registry_json jsonb not null default '{}'::jsonb,
  verified_at timestamptz,
  refreshed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pgt_certifications_grader_cert_unique unique (grader, cert_number)
);

create index if not exists pgt_certifications_catalog_idx
  on public.pgt_certifications (catalog_id)
  where catalog_id is not null;

create table if not exists public.pgt_population_snapshots (
  id uuid primary key default gen_random_uuid(),
  catalog_id text not null,
  franchise text not null default 'pokemon',
  grader text not null,
  grade text,
  population_count integer,
  population_higher integer,
  population_note text,
  source text,
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists pgt_population_snapshots_catalog_grader_idx
  on public.pgt_population_snapshots (catalog_id, grader, captured_at desc);

create table if not exists public.pgt_market_comps (
  id uuid primary key default gen_random_uuid(),
  catalog_id text not null,
  franchise text not null default 'pokemon',
  grade_bucket text,
  kind text not null check (kind in ('sold', 'active', 'reference')),
  title text not null,
  price_usd numeric(12, 2),
  observed_at date,
  url text,
  source text,
  slab text,
  identity_hash text,
  ingested_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Prevent comp table blow-up: avoid duplicates for the same catalog + evidence key.
create unique index if not exists pgt_market_comps_dedupe_idx
  on public.pgt_market_comps (
    catalog_id,
    grade_bucket,
    kind,
    url,
    price_usd,
    observed_at,
    source,
    identity_hash
  );

create index if not exists pgt_market_comps_catalog_observed_idx
  on public.pgt_market_comps (catalog_id, observed_at desc nulls last);

create index if not exists pgt_market_comps_catalog_grade_idx
  on public.pgt_market_comps (catalog_id, grade_bucket, kind);

comment on table public.pgt_certifications is 'Phase B cert spine keyed to catalog_id (Pokémon-first).';
comment on table public.pgt_population_snapshots is 'Time-series grader population by catalog_id.';
comment on table public.pgt_market_comps is 'Shared historical comps for market card pages and FMV.';

alter table public.pgt_certifications enable row level security;
alter table public.pgt_population_snapshots enable row level security;
alter table public.pgt_market_comps enable row level security;

-- Service role writes; authenticated read for market pages (Phase C).
create policy pgt_market_comps_read_authenticated
  on public.pgt_market_comps for select
  to authenticated
  using (true);

create policy pgt_population_snapshots_read_authenticated
  on public.pgt_population_snapshots for select
  to authenticated
  using (true);

create policy pgt_certifications_read_authenticated
  on public.pgt_certifications for select
  to authenticated
  using (true);
