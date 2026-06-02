-- PGT Digital Scan Vault — persisted scanner-grade card crops per user session.

create table if not exists public.digital_scan_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  session_id uuid references public.scan_sessions(id) on delete set null,
  extracted_card_id uuid references public.extracted_cards(id) on delete set null,
  specimen_key text not null,
  storage_path text not null,
  filename text not null,
  mime text not null default 'image/jpeg',
  width int,
  height int,
  card_index_on_page int,
  lane text not null check (lane in ('raw', 'graded')),
  catalog_id text,
  sidecar_json jsonb not null default '{}'::jsonb,
  content_sha256 text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists digital_scan_assets_user_created_idx
  on public.digital_scan_assets (user_id, created_at desc);

create index if not exists digital_scan_assets_session_idx
  on public.digital_scan_assets (session_id)
  where session_id is not null;

create unique index if not exists digital_scan_assets_session_specimen_uidx
  on public.digital_scan_assets (session_id, specimen_key)
  where session_id is not null;

-- Explicit constraint for upsert onConflict
do $$ begin
  alter table public.digital_scan_assets
    add constraint digital_scan_assets_session_specimen_unique
    unique (session_id, specimen_key);
exception
  when duplicate_object then null;
end $$;
