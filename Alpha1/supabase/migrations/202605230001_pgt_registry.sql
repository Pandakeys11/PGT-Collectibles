-- PGT Registry Phase 1: canonical card identities, slab cert cache, observation log.

create table if not exists public.pgt_card_identities (
  id uuid primary key default gen_random_uuid(),
  identity_hash text not null,
  franchise text not null default 'pokemon',
  canonical_name text not null,
  set_name text,
  card_number text,
  year text,
  variant_key text,
  lane text not null default 'raw' check (lane in ('raw', 'graded')),
  grader text,
  grade text,
  cert_number text,
  catalog_id text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  observation_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pgt_card_identities_hash_unique unique (identity_hash)
);

create index if not exists pgt_card_identities_franchise_name_idx
  on public.pgt_card_identities (franchise, lower(canonical_name));

create index if not exists pgt_card_identities_cert_idx
  on public.pgt_card_identities (grader, cert_number)
  where cert_number is not null;

create table if not exists public.pgt_slab_registry (
  id uuid primary key default gen_random_uuid(),
  grader text not null,
  cert_number text not null,
  pgt_card_identity_id uuid references public.pgt_card_identities(id) on delete set null,
  provider text,
  registry_json jsonb not null default '{}'::jsonb,
  population_note text,
  grade_date text,
  gemrate_id text,
  registry_url text,
  is_verified boolean not null default false,
  refreshed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pgt_slab_registry_grader_cert_unique unique (grader, cert_number)
);

create index if not exists pgt_slab_registry_identity_idx
  on public.pgt_slab_registry (pgt_card_identity_id);

create index if not exists pgt_slab_registry_refreshed_idx
  on public.pgt_slab_registry (refreshed_at desc);

create table if not exists public.pgt_card_observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.app_users(id) on delete set null,
  pgt_card_identity_id uuid references public.pgt_card_identities(id) on delete set null,
  session_id uuid references public.scan_sessions(id) on delete set null,
  extracted_card_id uuid references public.extracted_cards(id) on delete set null,
  event_type text not null check (
    event_type in (
      'session_save',
      'registry_hydrate',
      'enrich_complete',
      'user_confirm',
      'user_reject',
      'user_edit'
    )
  ),
  catalog_identity_status text,
  confidence numeric(5, 4),
  fmv_usd numeric(12, 2),
  grade_bucket text,
  provider text,
  payload_json jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists pgt_card_observations_user_observed_idx
  on public.pgt_card_observations (user_id, observed_at desc);

create index if not exists pgt_card_observations_identity_idx
  on public.pgt_card_observations (pgt_card_identity_id, observed_at desc);

create index if not exists pgt_card_observations_event_idx
  on public.pgt_card_observations (event_type, observed_at desc);

alter table public.extracted_cards
  add column if not exists pgt_card_identity_id uuid references public.pgt_card_identities(id) on delete set null;

create index if not exists extracted_cards_pgt_identity_idx
  on public.extracted_cards (pgt_card_identity_id)
  where pgt_card_identity_id is not null;

drop trigger if exists pgt_card_identities_touch_updated_at on public.pgt_card_identities;
create trigger pgt_card_identities_touch_updated_at
before update on public.pgt_card_identities
for each row execute function public.touch_updated_at();

drop trigger if exists pgt_slab_registry_touch_updated_at on public.pgt_slab_registry;
create trigger pgt_slab_registry_touch_updated_at
before update on public.pgt_slab_registry
for each row execute function public.touch_updated_at();

alter table public.pgt_card_identities enable row level security;
alter table public.pgt_slab_registry enable row level security;
alter table public.pgt_card_observations enable row level security;

drop policy if exists "Service role manages pgt_card_identities" on public.pgt_card_identities;
create policy "Service role manages pgt_card_identities"
on public.pgt_card_identities for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "Service role manages pgt_slab_registry" on public.pgt_slab_registry;
create policy "Service role manages pgt_slab_registry"
on public.pgt_slab_registry for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "Users read own pgt_card_observations" on public.pgt_card_observations;
create policy "Users read own pgt_card_observations"
on public.pgt_card_observations for select
using (
  user_id in (
    select id from public.app_users where clerk_user_id = auth.jwt() ->> 'sub'
  )
);

drop policy if exists "Service role manages pgt_card_observations" on public.pgt_card_observations;
create policy "Service role manages pgt_card_observations"
on public.pgt_card_observations for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

comment on table public.pgt_card_identities is 'Canonical PGT card identity (raw or graded) keyed by identity_hash';
comment on table public.pgt_slab_registry is 'Cached grader cert lookups (PSA/CGC/BGS) with population snapshots';
comment on table public.pgt_card_observations is 'Append-only timeline of extractions, enrich, registry, and user actions';
