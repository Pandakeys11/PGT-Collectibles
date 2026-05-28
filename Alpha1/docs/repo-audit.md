# Repo audit (Alpha1 / PGT_Vision)

Last reviewed: 2026-05-28. Operator checklist: *is the repo organized and deployable?*

## Layout

| Path | Role |
|------|------|
| `PGT_Vision/` | Git root; workspace `package.json` delegates to Alpha1 |
| `Alpha1/` | **Production Next.js app** (Vercel root directory) |
| `PGTVision/` | Local V1 reference — **gitignored**, do not commit |
| `Alpha1/src/app/` | App Router pages + API routes |
| `Alpha1/src/lib/` | Domain logic (scan, market, catalog, pgt-registry, ai) |
| `Alpha1/src/components/` | UI by feature (`scanner-chat` = Liquid Scan UI) |
| `Alpha1/scripts/` | CLI — index in [../scripts/README.md](../scripts/README.md) |
| `Alpha1/supabase/migrations/` | SQL migrations (18 files) |
| `Alpha1/docs/` | Operator docs — index in [README.md](./README.md) |

## Health checklist

```bash
cd Alpha1
npm install
cp .env.example .env.local   # fill secrets
npm run lint                 # strict (max-warnings=0)
npm run build
npm run db:verify            # after Supabase URL + service role set
npm run verify:catalog-health
```

Smoke (dev server on `:3002`):

```bash
npm run smoke:scan
npm run smoke:enrich
npm run smoke:enrich-batch
```

## Git hygiene

| Track | Ignore / local only |
|-------|---------------------|
| Source, migrations, `.env.example`, docs, `public/` manifests | `.env*.local`, `.env.production` |
| `supabase/apply-pending-migrations.sql` (regenerate with `db:build-pending`) | `.next/`, `node_modules/`, `.cache/` |
| | `.tmp/` — resumable backfill checkpoints (keep while jobs run) |
| | `_scratch/` — probe HTML/JSON/logs (safe to delete anytime) |

Never commit real API keys. Use `.env.production.example` as the Vercel import template.

## API surface (easy to miss)

| Route | Purpose |
|-------|---------|
| `POST /api/scan/enrich-batch` | Batch catalog/market enrich (Liquid Scan) |
| `POST /api/jobs/population-harvest` | Grader pop harvest job |
| `GET /api/market/live-ticker` | Live market pulse banner |
| `GET /api/market/ebay-ending-soon` | eBay ending-soon auctions panel |
| `GET /api/catalog/set-insight` | Set insight rail data |

`src/proxy.ts` protects `/api/scan/enrich(.*)` — covers both `enrich` and `enrich-batch`.

## Migrations (apply in order)

All files in `supabase/migrations/` sorted by name. Full table: [supabase-production-setup.md](./supabase-production-setup.md).

**Preferred:** `npm run db:apply` (incremental) or `npm run db:push` (Supabase CLI).

**Paste bundle:** `npm run db:build-pending` then `supabase/apply-pending-migrations.sql` or `npm run db:apply:bundle`.

Recent shortcuts:

| Script | Migration |
|--------|-----------|
| `db:apply:catalog-indexes` | `202605270001` |
| `db:apply:market-intel` | `202605280001` |
| `db:apply:localized-artwork` | `202605280002` |
| `db:apply:set-insights` | `202605280003` |

## Code organization notes

| Area | Notes |
|------|-------|
| Liquid Scan | Route `/liquid-scan`; code in `scanner-chat/` folders (historical name) |
| `api/catalog/*` vs `api/pokedex/*` | Catalog = multi-franchise master DB; Pokedex = Pokémon browse/hydration |
| `enrich-runner.ts` | Shared enrich logic for single + batch routes |
| `catalog-price-utils.ts` | Centralized TCG USD — prefer over ad-hoc price helpers |

## Env groups (`.env.example`)

| Group | Keys |
|-------|------|
| Auth | Clerk publishable + secret + webhook |
| DB | Supabase URL + service role |
| Vision | GROQ / GEMINI / OPENROUTER / OPENAI / XAI + `VISION_*` tuning |
| Scan UX | `NEXT_PUBLIC_VISION_*`, `SCAN_PRECISION_CROP*`, `SCAN_AUTO_REPORT` |
| Market | `MARKET_*`, eBay, Bright Data, PriceCharting, JustTCG |
| Cert / pop | PSA, GemRate, Apify, Bright Data (`BRIGHTDATA_*`) |
| Cron | `CRON_SECRET` for `/api/jobs/*` |

## Known gaps (non-blocking)

- ESLint may report hook-deps warnings in a few components; `npm run build` typecheck is the CI gate.
- `smoke:enrich-batch` requires a running dev server and auth.
- Auto session report after scan adds latency — disable with `SCAN_AUTO_REPORT=0` when profiling.
- `catalog:sync:set-prices` requires a set ID: `node scripts/sync-pokemon-tcg-prices.mjs --set=sv9`

See [scan-pipeline-audit.md](./scan-pipeline-audit.md) for Liquid Scan latency optimization priorities.
