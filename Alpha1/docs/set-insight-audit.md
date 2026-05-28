# Set Insight — Audit & Guard Rails

Master Catalog set insight (`/api/catalog/set-insight`) powers the right-rail panel in **Pokémon** browse only (`PokedexBrowser` → `CatalogSetInsightRail`). It is **set-scoped**, not rarity-scoped.

## Data flow

```
User opens set (setId)
  → CatalogSetInsightRail: GET /api/catalog/set-insight?setId=X  (once per set)
  → route: memory cache → Supabase tcg_catalog_set_insights → buildCatalogSetInsight
  → loadSetCards: ALL cards in set (up to 3000 DB rows), optional live TCG API hydrate
  → catalog rollups + optional AI web research
  → persist ready payload (memory + DB)
```

Rarity / finish / page tabs only change `/api/pokedex/cards` (grid). They must **not** re-trigger set insight.

## Insight sections

| Section | Source | Scope |
|---------|--------|--------|
| **Set catalog sum** | `setWide` rollup | Full set |
| **In view** | Client `rollupSetInsightCards(cards)` | Current filter/page only |
| **Summary / market pulse** | AI or catalog fallback | Full set narrative |
| **Chase & demand** | Overlay `setValueNotes` → AI `chaseNotes` | Full set |
| **Highest value** | `topValueCards(cards, 8)` + AI merge | Full set |
| **Price momentum** | `topMomentumCards` (≥3% move) + AI | Full set |
| **Promos & specials** | `promoCardsInSet` + AI | Full set |
| **Sealed product** | Overlay eBay links → AI priced rows | Full set |
| **Sources** | Bulbapedia overlay + AI references | — |

## Guard rails

### Catalog build (`build-catalog-set-insight.ts`)

- Loads **entire set** from `listCardsFromDb("pokemon", setId, pageSize: 3000)` — no rarity filter.
- **Live TCG API** only when priced coverage is sparse:
  - ≤30 cards: &lt;15% priced → fetch
  - ≤120 cards: &lt;8%
  - larger: &lt;3%
- **`ready`** requires cards plus at least one of: TCGPlayer-priced rows, summary, top/momentum/sealed/chase.
- **`CATALOG_SET_INSIGHT_DISABLE_GROQ=1`**: catalog-only, no AI.

### Pricing (`set-insight-utils.ts`)

- Per-card price: `resolveCatalogRawFmv` (TCGPlayer finish/rarity-aware) → fallback `bestTcgUsd`.
- Set-wide sum uses same FMV path via `cardInsightRow` (aligned with card grid ribbons).
- Momentum: PokeTrace `momentumPct` → Cardmarket trend vs 7d avg.
- **Not used today**: `pgt_market_comps` sold/active rows in set insight (scan enrich only).

### AI skip (`research-budget.ts`)

Skip web research when **all** are true (unless `refresh=1` or `SET_INSIGHT_FORCE_AI=1`):

- `pricedPct >= SET_INSIGHT_AI_SKIP_PRICED_PCT` (default **80**)
- `topValueCount >= 5`
- `momentumCount >= 1`

Provider order: `SET_INSIGHT_AI_ORDER` (default `groq,gemini`). Cooldown on 429: `AI_RESEARCH_COOLDOWN_MIN` (default 15).

### AI output rules (`set-insight-groq.ts`, `set-insight-ai.ts`)

- JSON-only; no invented card names.
- `priceLabel`: `SOLD` | `ACTIVE` | `REFERENCE` | `TCGPlayer market`.
- Merge AI rows with catalog by normalized name; cap merged lists (~10).
- `attachCatalogIds` binds AI names to catalog rows for images/catalogId.

### Caching

| Layer | Key | TTL |
|-------|-----|-----|
| In-memory (route) | `setId` | `SET_INSIGHT_CACHE_HOURS` (default 24h) |
| Supabase `tcg_catalog_set_insights` | `franchise,set_id` | Same TTL on read |
| Client rail | `setId` | Until set change or manual refresh |

`refresh=1`: returns stale body immediately if cached, rebuilds in background with `forceAi: true`.

### Auth

- `/api/catalog/set-insight` is Clerk-protected (`proxy.ts`).

## Env knobs

| Variable | Default | Effect |
|----------|---------|--------|
| `SET_INSIGHT_CACHE_HOURS` | 24 | Cache TTL |
| `SET_INSIGHT_AI_SKIP_PRICED_PCT` | 80 | Skip AI when catalog strong |
| `SET_INSIGHT_FORCE_AI` | — | Always run AI |
| `SET_INSIGHT_AI_ORDER` | groq,gemini | Provider order |
| `SET_INSIGHT_GROQ_MAX_TOKENS` | 2000 | Groq Compound cap |
| `CATALOG_SET_INSIGHT_DISABLE_GROQ` | — | Disable all AI |
| `POKEMON_TCG_API_KEY` | — | Live price hydrate + catalog sync |

## FMV + comps (2026-05-28)

- **TCGPlayer reference comps** — `catalog-tcg-reference-comps.ts` writes `kind=reference` rows to `pgt_market_comps` when prices sync.
- **Set price sync** — `syncSetCatalogPricesFromTcgApi(setId)` backfills `prices_json` + comps for entire set.
- **Set insight FMV** — `loadSetMarketEvidenceMap` feeds `resolveCatalogRawFmv` (TCG → active → sold → PC).
- **Nightly** — `nightly-platform` rebuilds insight when set ingest completes; `nightly-final` refreshes up to 3 sets.

## Known gaps (remaining)

1. **Non-Pokémon** — `GenericCatalogBrowser` has no set insight rail.
2. **Canonical eBay-led FMV** — PGTVision `deriveCanonicalMarketValue` not ported; Alpha1 uses TCG-first + comps.
3. **`market-master-guard-rails.ts`** — Liquid Scan / Ask only.

## Fixes applied (2026-05-28)

- Client: fetch only when `setId` changes; no flash/clear on rarity tier switch.
- Server: persist ready payloads to `tcg_catalog_set_insights` for cold-start stability.
- Rollup: set-wide sum uses FMV (`cardInsightRow`) not raw TCGPlayer max variant only.

## Apply DB migration

```bash
npm run db:apply
```

Or run `supabase/migrations/202605280003_tcg_catalog_set_insights.sql` in the Supabase SQL editor.
