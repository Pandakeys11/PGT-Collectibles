# Pokémon PSA 10 catalog backfill

Bulk, resumable job that fills **PSA 10** market data for every card in every Pokémon set:

| Tier | Source | Stored as |
|------|--------|-----------|
| **1** | PriceCharting graded / PSA 10 guide | `pgt_market_comps` (`kind=reference`, `grade_bucket=psa10`) + `prices_json.priceChartingPsa10Usd` |
| **3** | eBay sold + active (grade-specific lane harvest) | `pgt_market_comps` (`kind=sold` / `active`, `grade_bucket=psa10`) |

Run **after** raw TCGPlayer price backfill (`catalog:backfill:prices`) so catalog rows and raw FMV exist.

## Commands

```bash
# Resume full catalog (default)
npm run catalog:backfill:psa10

# Fresh checkpoint
npm run catalog:backfill:psa10:reset

# Single set
npx --yes tsx scripts/backfill-pokemon-psa10-comps.ts --set=sv9 --resume

# Dry run (no writes)
npx --yes tsx scripts/backfill-pokemon-psa10-comps.ts --set=base1 --dry-run

# Tier 1 only (no eBay)
npx --yes tsx scripts/backfill-pokemon-psa10-comps.ts --skip-ebay

# Tier 3 only (no PriceCharting)
npx --yes tsx scripts/backfill-pokemon-psa10-comps.ts --skip-pricecharting
```

## Checkpoint files

| File | Purpose |
|------|---------|
| `.tmp/pokemon-psa10-backfill.json` | Resume cursor (`setId` + `cardIndex`) + stats |
| `.tmp/pokemon-psa10-backfill-failures.jsonl` | Per-card errors |

## Required env

- `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- **Tier 1:** `PRICECHARTING_API_TOKEN`
- **Tier 3:** eBay browse (`EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`) and/or sold scrape (Bright Data — see `verify:ebay-sold`)

## Tuning

| Variable | Default | Notes |
|----------|---------|-------|
| `PSA10_BACKFILL_DELAY_MS` | `450` | Pause between cards (eBay rate limits) |
| `PSA10_BACKFILL_SET_PAUSE_MS` | `2000` | Pause after each completed set |
| `PSA10_BACKFILL_SKIP_EBAY` | — | Same as `--skip-ebay` |
| `PSA10_BACKFILL_SKIP_PRICECHARTING` | — | Same as `--skip-pricecharting` |

## Implementation

- Harvest: `src/lib/catalog/psa10-catalog-harvest.ts`
- CLI: `scripts/backfill-pokemon-psa10-comps.ts`
- Comps persist with per-row `grade_bucket` (PSA 10 evidence no longer inherits raw bucket)
