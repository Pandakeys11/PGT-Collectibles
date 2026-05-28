# Nightly cron jobs

All times below are **US Eastern Standard Time (EST, UTC−5)**. Vercel cron expressions run in **UTC** (fixed offset — they do not auto-shift for daylight saving). During **EDT** (UTC−4), jobs fire **one hour earlier** on the clock (e.g. 02:30 EST schedule → 03:30 AM EDT wall time). Adjust cron UTC hours by −1 in summer if you need strict EDT alignment.

## Schedule

| EST | UTC | Route | Purpose |
|-----|-----|-------|---------|
| **02:30** | 07:30 | `/api/jobs/nightly-platform` | Catalog sync + market ingest (chunk 1) |
| **02:50** | 07:50 | `/api/jobs/market-ingest` | Market ingest (chunk 2) |
| **03:10** | 08:10 | `/api/jobs/market-ingest` | Market ingest (chunk 3) |
| **03:30** | 08:30 | `/api/jobs/market-ingest` | Market ingest (chunk 4) |
| **03:50** | 08:50 | `/api/jobs/market-ingest` | Market ingest (chunk 5) |
| **06:10** | 11:10 | `/api/jobs/nightly-final` | **Catalog sync + full nightly report** |

`vercel.json` cron expressions:

```
30 7 * * *   nightly-platform
50 7 * * *   market-ingest
10 8 * * *   market-ingest
30 8 * * *   market-ingest
50 8 * * *   market-ingest
10 11 * * *  nightly-final
```

## Final run (06:10 EST)

`/api/jobs/nightly-final`:

1. Incremental **catalog sync** (sets + recent cards)
2. **Full nightly report** — comps/pop counts in the last ~6h, catalog totals, market-ingest cursor (current set + offset)
3. Persists report on `tcg_catalog_sources.raw_json.lastNightlyReport`

Local:

```bash
npm run platform:nightly:final
```

## Manual triggers

```bash
npm run platform:nightly          # 02:30 slot equivalent
npm run market:ingest             # market chunk
npm run market:ingest:set -- base1
npm run platform:nightly:final    # 06:10 slot
```

Requires `CRON_SECRET` in `.env.local` / Vercel (Bearer token on cron invocations).

## Market ingest (02:50–03:50 EST)

Full-set rotation vintage → modern. See env vars in `.env.example` (`MARKET_INGEST_*`, `MARKET_NIGHTLY_AI_ORDER`, `GEMINI_API_KEY`).

Report window stats: `compsIngested`, `popSnapshots`, `catalogCards`, `pokemonSets`, current `marketIngest.setCode`.
