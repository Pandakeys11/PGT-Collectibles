# Multi-franchise scanning (PGT Vision / Liquid Scan)

PGT Vision supports **Pokemon**, **other TCGs**, and **sports** in one pipeline with dedicated catalog APIs and a Supabase cache.

## Architecture

```
Upload → Vision extract → normalize + franchise → enrich (catalog + market) → UI
```

| Franchise | Catalog source (live scan) | DB sync (`npm run catalog:sync:*`) | Market comps |
|-----------|---------------------------|--------------------------------------|--------------|
| **Pokemon** | [Pokemon TCG API](https://api.pokemontcg.io/v2) | Optional (live API primary) | Pokemon prices + eBay + PriceCharting |
| **Magic** | [Scryfall](https://scryfall.com/docs/api) | `catalog:sync:magic` | TCGPlayer via Scryfall + PriceCharting |
| **Yu-Gi-Oh** | [YGOPRODeck](https://db.ygoprodeck.com/api-guide/) | `catalog:sync:yugioh` | TCGPlayer + PriceCharting |
| **One Piece** | [OPTCG API](https://optcgapi.com) | `catalog:sync:onepiece` | TCGPlayer + PriceCharting |
| **Lorcana** | [Lorcast](https://lorcast.com/docs/api) | `catalog:sync:lorcana` (LorcanaJSON) | TCGPlayer + PriceCharting |
| **Dragon Ball** | Web fallback (Api TCG optional w/ key) | — | PriceCharting + eBay |
| **Sports** | Web fallback (PriceCharting/PSA) | — | PriceCharting + eBay sports category |

## Catalog resolution order (`catalog-router.ts`)

1. **Live franchise API** — authoritative when `confirmed`
2. **Supabase `tcg_catalog_cards`** — synced cache for faster repeat matches
3. **Generic web catalog** — ranked TCGPlayer/PriceCharting snippets (`likely` max)

Only **`confirmed`** matches overwrite vision fields (`catalog-merge.ts`).

## Database setup

```bash
cd c:\Users\jmrit\PGT_Vision\Alpha1
node scripts/build-pending-sql.mjs   # bundle all migrations
npm run db:apply                     # applies tcg_catalog + market_snapshots + auth
npm run db:verify

# Populate caches (run per franchise; yugioh/magic can take several minutes)
npm run catalog:sync:magic
npm run catalog:sync:yugioh
npm run catalog:sync:lorcana
npm run catalog:sync:onepiece
# or: npm run catalog:sync:all
```

### Tables

- `tcg_catalog_sources` — API registry + last sync time
- `tcg_catalog_sets` — set metadata (future browse UI)
- `tcg_catalog_cards` — `franchise` + `catalog_id` + search_text + images/prices JSON

Migration: `supabase/migrations/202605220001_tcg_catalog.sql`

## Running Liquid Scan

```bash
npm run dev:clean
```

Open: `http://localhost:3002/liquid-scan`

## Env keys (optional)

| Variable | Use |
|----------|-----|
| `POKEMON_TCG_API_KEY` | Higher Pokemon TCG API limits |
| `APITCG_API_KEY` | Dragon Ball FW sync via apitcg.com (future) |

## Related files

| Path | Role |
|------|------|
| `src/lib/market/catalog-router.ts` | Franchise routing + fallback |
| `src/lib/market/catalog-sources.ts` | Source registry |
| `src/lib/market/scryfall-catalog.ts` | MTG |
| `src/lib/market/yugioh-catalog.ts` | Yu-Gi-Oh |
| `src/lib/market/onepiece-catalog.ts` | One Piece |
| `src/lib/market/lorcana-catalog.ts` | Lorcana |
| `src/lib/market/pokemon-catalog.ts` | Pokemon |
| `src/lib/catalog/db-catalog.ts` | Supabase cache search/upsert |
| `scripts/catalog-sync.mjs` | Bulk sync jobs |
| `src/app/api/scan/enrich/route.ts` | Scan enrich entry |

## Roadmap

1. Sports structured catalog (COMC / team-set normalization)
2. Dragon Ball via Api TCG when `APITCG_API_KEY` set
3. UI franchise override when auto-detect is wrong
4. Pokemon optional bulk sync into `tcg_catalog_cards`
5. Master catalog browse beyond Pokemon (sets grid per franchise)
