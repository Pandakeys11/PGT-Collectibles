# Repo audit (Alpha1 / PGT_Vision)

Last reviewed: 2026-05-28. Use this as the operator checklist for “is the repo organized and deployable?”

## Layout

| Path | Role |
|------|------|
| `PGT_Vision/` | Git root; workspace `package.json` delegates to Alpha1 |
| `Alpha1/` | **Production Next.js app** (Vercel root directory) |
| `PGTVision/` | Local V1 reference — **gitignored**, do not commit |
| `Alpha1/src/app/` | App Router pages + API routes |
| `Alpha1/src/lib/` | Domain logic (scan, market, catalog, pgt-registry, ai) |
| `Alpha1/scripts/` | CLI: catalog sync, ingest, verify, smoke tests |
| `Alpha1/supabase/migrations/` | SQL migrations (apply via `npm run db:*`) |
| `Alpha1/docs/` | Operator docs — index in [README.md](./README.md) |

## Health checklist

```bash
cd Alpha1
npm install
cp .env.example .env.local   # fill secrets
npm run lint                 # strict (max-warnings=0)
npm run build
npm run db:verify            # after Supabase URL + service role set
```

Smoke (dev server on `:3002`):

```bash
npm run smoke:scan
npm run smoke:enrich
npm run smoke:enrich-batch
```

## Git hygiene

- **Tracked:** source, migrations, `.env.example`, docs, manifest JSON under `src/data/`.
- **Ignored:** `.env*.local`, `.next/`, `node_modules/`, `**/.tmp-*` scratch captures.
- **Do not commit:** `.tmp-psa-*`, `.tmp-page-pop.*`, probe HTML/JSON in repo root (now in `.gitignore`).

Large in-flight work is on `main` with many modified + untracked files — plan a focused commit series (cert/Bright Data, live ticker, enrich-batch, scan perf) before deploy.

## API surface (new / easy to miss)

| Route | Purpose |
|-------|---------|
| `POST /api/scan/enrich-batch` | Batch catalog/market enrich (Liquid Scan via `enrich-session-pipeline`) |
| `POST /api/jobs/population-harvest` | Grader pop harvest job |
| `GET /api/market/live-ticker` | Live market pulse banner |

`src/proxy.ts` protects `/api/scan/enrich(.*)` — covers both `enrich` and `enrich-batch`.

## Code organization notes

| Area | Status | Recommendation |
|------|--------|----------------|
| `enrich-runner.ts` | Shared enrich logic + batch route | Consolidate `enrich/route.ts` to call `runEnrichForSpecimen` (remove duplicate) |
| `enrich-batch` | Wired | `runEnrichSessionPipeline` → `enrichExtractedCardsBatch`; single-card paths still use `/enrich` |
| `catalog-price-utils.ts` | Centralized TCG USD | Used by ticker + set insight; prefer over ad-hoc `bestTcgUsd` |
| Liquid Scan perf | Documented in [scan-pipeline-audit.md](./scan-pipeline-audit.md) | Defer market enrich + conditional vision verify |

## Migrations (apply in order)

1. `202605220001_tcg_catalog.sql` — catalog tables  
2. `202605230001_pgt_registry.sql` — registry / slabs  
3. `202605270001_tcg_catalog_lookup_indexes.sql` — lookup perf  
4. `202605280001_pgt_market_intel.sql` — market intel persist  
5. `202605280002_tcg_catalog_localized_artwork.sql` — JPN artwork overlays  

Shortcuts: `npm run db:apply:market-intel`, `db:apply:localized-artwork`, or `db:apply` for incremental.

## Env groups (`.env.example`)

| Group | Keys |
|-------|------|
| Auth | Clerk publishable + secret + webhook |
| DB | Supabase URL + service role |
| Vision | GROQ / GEMINI / OPENROUTER / OPENAI / XAI + `VISION_*` tuning |
| Scan UX | `NEXT_PUBLIC_VISION_*`, `SCAN_PRECISION_CROP*`, `SCAN_AUTO_REPORT` |
| Market | `MARKET_SKIP_LLM_WHEN_MEMORY`, ingest cron secrets |
| Cert / pop | PSA, GemRate, Apify, **Bright Data** (`BRIGHTDATA_*`, `CERT_REGISTRY_BRIGHTDATA`) |

## Known gaps (non-blocking)

- ESLint may report hook-deps warnings in a few components; build typecheck is the gate for CI.
- `smoke:enrich-batch` requires a running dev server and auth (or dev bypass for vision only).
- Auto session report after scan adds latency — disable with `SCAN_AUTO_REPORT=0` when profiling.

See [scan-pipeline-audit.md](./scan-pipeline-audit.md) for Liquid Scan latency optimization priorities.
