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
| Market enrich every scan | Done | Catalog + market phases for all specimens (not Speed-gated) |
| Session intelligence report | Done | Auto after enrich when `SCAN_AUTO_REPORT` ≠ 0 (not Speed-gated) |
| Premium grade research | Done | eBay lane harvest + web brief with session comps |

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

## Market knowledge layer (institutional memory)

**Goal:** Every locked `catalog_id` builds compound market intelligence in Postgres and serves it on the next request.

| Piece | Path |
|-------|------|
| Unified read model | `buildPokemonMarketKnowledge()` in `src/lib/market/pokemon-market-knowledge.ts` |
| Persisted comps → evidence | `src/lib/market/persisted-market-evidence.ts` |
| TCGPlayer / CardMarket refs | `src/lib/market/catalog-reference-evidence.ts` |
| Enrich uses memory first | `researchCardMarket(card, { catalogId })` — skips heavy LLM when ≥6 sold comps cached |
| Read API | `GET /api/market/intel?catalogId=neo2-9` (full knowledge) · `?view=raw` (rows only) |
| Background ingest | `GET /api/jobs/market-ingest?secret=CRON_SECRET&limit=8` |
| Nightly platform cron | `GET /api/jobs/nightly-platform` (catalog sync + market memory) · `vercel.json` 05:00 UTC |

```bash
# Deepen memory for one card or a batch (dev server must be running, or set NEXT_PUBLIC_APP_URL)
npm run market:ingest -- neo2-9
npm run market:ingest -- --limit=12
curl "http://localhost:3002/api/market/intel?catalogId=neo2-9"
```

**What “most knowledgeable” means in practice**

1. **Catalog spine** — 23k+ Pokémon rows, set/number/rarity/art, browse + scan match.
2. **Institutional comps** — every scan/Pick/enrich appends sold/active rows to `pgt_market_comps`.
3. **Grader intelligence** — cert registry + population snapshots when slab verified.
4. **Live adapters** — eBay, PriceCharting, TCGPlayer, Card Ladder, GemRate (env-gated).
5. **FMV engine** — grade-bucket medians, confidence labels, print-edition scoping.

## Phase C — Market card pages (complete)

| Item | Status | Notes |
|------|--------|-------|
| `/market/pokemon/[catalogId]` | Done | Server-rendered `buildPokemonMarketKnowledge()` |
| `PokemonMarketIntelView` | Done | FMV, grade ladder, comps, pop, certs, TCGPlayer refs |
| `POST /api/market/intel/refresh` | Done | Live ingest when memory thin or `force: true` |
| Catalog entry | Done | “Market intel” on Master Catalog card detail |
| Auth | Done | `/market/pokemon(.*)` + `/api/market/intel(.*)` in `proxy.ts` |

```bash
# Open in browser (signed in)
/market/pokemon/neo2-9
curl -X POST http://localhost:3002/api/market/intel/refresh \
  -H "Content-Type: application/json" \
  -d '{"catalogId":"neo2-9"}'
npm run verify:market-intel neo2-9
```

## Phase D — Background workers

Vercel cron or GitHub Actions:

| Job | Route / script |
|-----|----------------|
| Catalog art filler | `GET /api/jobs/catalog-art-filler` |
| Cert drain | `GET /api/jobs/cert-drain` |
| Nightly platform | `GET /api/jobs/nightly-platform` · `npm run platform:nightly` |
| Market worker | `GET /api/jobs/market-ingest` · `npm run market:ingest` |
| Population filler | `GET /api/jobs/population-filler` |

**Live in `vercel.json`:** 02:30–03:50 EST market platform + ingest · 06:10 EST `nightly-final` (catalog + report). See `docs/nightly-cron.md`. Local: `npm run platform:nightly` · `npm run platform:nightly:final`.

All require `CRON_SECRET` (Vercel cron sends `Authorization: Bearer CRON_SECRET`).

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
