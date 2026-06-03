# Alpha1 scripts

CLI utilities for catalog sync, market ingest, database migrations, and smoke tests. **Production deploys do not run these at runtime** — they are operator/dev tools invoked via `npm run` from the `Alpha1/` directory.

## Layout

| Path | Purpose |
|------|---------|
| `scripts/*.mjs` | Node ESM scripts (most npm commands) |
| `scripts/backfill-pokemon-psa10-comps.ts` | PSA 10 comp backfill (tsx) |
| `scripts/backfill-pokemon-fmv-comps.ts` | Full-catalog raw FMV + sold comps (tsx) |
| `scripts/lib/` | Shared helpers imported by scripts (not npm entrypoints) |
| `scripts/archive/` | Retired one-off probes — see [archive/README.md](./archive/README.md) |
| `scripts/load-env-local.mjs` | Loads `.env.local` for CLI scripts |

## npm scripts (by category)

See `package.json` for the full list. Common groups:

### Database

| Script | Purpose |
|--------|---------|
| `db:verify` | Schema + billing limits smoke |
| `db:apply` | **Preferred** — incremental migrations via Postgres |
| `db:apply:bundle` | Paste bundle (`supabase/apply-pending-migrations.sql`) |
| `db:build-pending` | Regenerate bundle after adding migrations |
| `db:push` | Supabase CLI link + push |
| `db:apply:market-intel` / `localized-artwork` / `set-insights` / `catalog-indexes` | Single-file hotfix apply |

### Catalog & prices

| Script | Purpose |
|--------|---------|
| `catalog:sync` / `catalog:sync:pokemon` | Incremental catalog sync |
| `catalog:backfill:prices` | Full TCGPlayer FMV backfill |
| `catalog:backfill:psa10` | PSA 10 comps backfill |
| `catalog:backfill:fmv` | Raw FMV + sold comps (60d lookback, resumable) |
| `catalog:sync:justtcg-prices` | JustTCG price hydrate |
| `verify:catalog-health` | Master DB coverage check |

### Market & nightly

| Script | Purpose |
|--------|---------|
| `market:ingest` / `market:ingest:set` | Set-scoped market memory |
| `platform:nightly` / `platform:nightly:final` | Cron-style platform jobs |
| `verify:ebay-sold` / `verify:pricecharting` / `verify:brightdata` | Sold + PriceCharting smoke |
| `setup:brightdata` | Bright Data cert/pop setup |

### App smoke (dev server on `:3002`)

| Script | Purpose |
|--------|---------|
| `smoke:scan` / `smoke:enrich` / `smoke:enrich-batch` | Scan + enrich API |
| `smoke:catalog` / `smoke:catalog-candidates` | Catalog match paths |

## Dev-only probes (no npm alias)

Ad-hoc debugging — safe to run locally; not part of CI:

| Script | Notes |
|--------|-------|
| `probe-tcg-api.mjs` | Pokémon TCG API sanity |
| `probe-brightdata-ebay.mjs` | Bright Data eBay HTML |
| `probe-binder-grid.mjs` | Binder UI grid |
| `probe-rarity-*.mjs` | Catalog rarity filters |
| `inspect-ebay-html.mjs` | eBay SERP HTML parse debug |
| `kill-all.mjs` | Kill stray Node dev processes (Windows) |
| `ngrok-clerk-hint.mjs` / `resolve-ngrok.mjs` | Tunnel helpers |

Prefer adding a `verify:*` or `smoke:*` npm script when a probe becomes part of the release checklist.

## Conventions

- Load env: `import { loadEnvLocal } from "./load-env-local.mjs"; loadEnvLocal();`
- Checkpoints / logs: `.tmp/` (gitignored, resumable jobs)
- Ad-hoc probes: `_scratch/probes/`, dev logs: `_scratch/logs/` (gitignored)
- Bright Data / unlocker cache: `.cache/` (gitignored)
- Long backfills: resumable checkpoints documented in `docs/catalog-psa10-backfill.md` and `docs/nightly-cron.md`
