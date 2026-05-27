# PGT Platform Phases (Alpha1 → PGTVision parity)

Uniform rollout order. Each phase builds on the previous spine: **`catalog_id`** (e.g. `neo2-9`).

## Phase A — Spine & scan UX (complete)

**Goal:** One catalog ID everywhere; users always see pick options.

| Item | Status | Notes |
|------|--------|-------|
| `ensureCatalogMatchOptions()` | Done | Enrich + catalog-candidates + broad DB search |
| `searchDbCatalogBroad()` | Done | Name / set / number / FTS widen |
| `MIN_CATALOG_PICK_OPTIONS = 3` | Done | UI auto-refresh when below threshold |
| DB-first Pokémon browse | Done | `tcg-api-server.ts` when cache populated |
| Master Catalog rarity tabs | Done | DB filter + `rarity-counts`; maps GX/LEGEND/promo labels |
| Registry `catalog_id` column | Exists | `pgt_card_identities.catalog_id` |
| Backfill script | Done | `npm run db:backfill-catalog-id` |
| Enrich telemetry | Done | Set `CATALOG_ENRICH_TELEMETRY=1` |

**Ops checklist**

```bash
# First time on an existing Supabase project (tables already created):
npm run db:apply:stamp
# Apply only new migration files (tracked in schema_migrations):
npm run db:apply
# One-off targets (safe to re-run):
npm run db:apply:catalog-indexes
npm run db:apply:market-intel
# Legacy monolithic bundle (avoid on prod — use incremental apply above):
# npm run db:apply:bundle
npm run catalog:sync:pokemon
npm run verify:catalog-health
# optional
npm run db:backfill-catalog-id -- --dry-run
```

## Phase B — Postgres intelligence tables (complete)

**Migration:** `supabase/migrations/202605280001_pgt_market_intel.sql`

| Table | Purpose |
|-------|---------|
| `pgt_certifications` | Cert ↔ `catalog_id` spine |
| `pgt_population_snapshots` | PSA/BGS/CGC/TAG pop history |
| `pgt_market_comps` | Shared sold/active/reference rows |

**Wired (runtime):**

| Trigger | Writes |
|---------|--------|
| `POST /api/scan/enrich` (market + full) | `pgt_market_comps` + cert/pop when `catalogId` locked |
| `POST /api/scan/observation` (`user_confirm`) | Identity `catalog_id` + intel persist from session evidence |
| `POST /api/scan/registry` | Cert/pop when `catalogId` passed |
| `GET /api/market/intel?catalogId=` | Read comps + population + certifications |

**Lib:** `src/lib/pgt-registry/pgt-market-intel-persist.ts`

**Ops:**

```bash
npm run db:apply          # includes 202605280001 when not yet stamped
npm run db:verify
npm run verify:market-intel neo2-9
```

**Phase D (next):** cert drain + market ingest cron jobs to refresh rows without a live scan.

## Phase C — Market card pages

Routes (planned):

- `/market/pokemon/[catalogId]` — card detail + FMV + comps from `pgt_market_comps`
- Stale-while-revalidate live adapters as fallback

## Phase D — Background workers

Vercel cron or GitHub Actions:

| Job | Route / script |
|-----|----------------|
| Catalog art filler | `GET /api/jobs/catalog-art-filler` |
| Cert drain | `GET /api/jobs/cert-drain` |
| Market worker | `GET /api/jobs/market-ingest` |
| Population filler | `GET /api/jobs/population-filler` |

All require `CRON_SECRET` (same as catalog sync).

## Phase E — Offline institutional SQLite

**Separate from production** — ops tooling only:

- `scripts/export-master-sqlite.mjs` (planned) — Supabase → `catalog-exports/pgt_master.sqlite`
- Legacy reference: `PGTVision/_scripts/export-master-db-catalog-xlsx.mjs`

Do not run SQLite in the Next.js request path.

## Environment matrix

| Concern | Variables |
|---------|-----------|
| Catalog cache | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `POKEMON_TCG_API_KEY` |
| Cron | `CRON_SECRET` |
| Multi-grader cert/pop | `GEMRATE_API_KEY` |
| PSA fallbacks | `PSA_API_*`, `APIFY_API_TOKEN`, `PSA_CERT_PAGE_SCRAPE` |
| Market comps | `EBAY_*`, `PRICECHARTING_API_TOKEN` |
| Telemetry | `CATALOG_ENRICH_TELEMETRY=1` |
