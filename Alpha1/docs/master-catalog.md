# Master catalog (multi-franchise)

Unified browse + scan handoff for Pokémon, Magic, Yu-Gi-Oh!, One Piece, Lorcana, and cached DB franchises.

## Browse UI

- **Component:** `MasterCatalogBrowser` (`src/components/catalog/master-catalog-browser.tsx`)
- **Pokémon:** Full Pokedex experience (eras, rarity tabs, variant artwork) via existing `/api/pokedex/*`
- **Magic:** Live Scryfall sets/cards + nightly DB cache
- **Other TCGs:** `GenericCatalogBrowser` → `/api/catalog/sets` + `/api/catalog/cards` (Supabase `tcg_catalog_*`)

## API

| Route | Purpose |
|-------|---------|
| `GET /api/catalog/franchises` | Franchise list, sync status, cached card counts |
| `GET /api/catalog/sets?franchise=magic` | Paginated sets (not Pokémon) |
| `GET /api/catalog/cards?franchise=&setId=` | Paginated cards in a set |
| `GET /api/catalog/card?franchise=&id=` | Single card |
| `GET /api/catalog/sync` | Incremental sync (cron; requires `CRON_SECRET`) |

## Database

Migration: `supabase/migrations/202605220001_tcg_catalog.sql`

- `tcg_catalog_sources` — API source registry + `last_synced_at`
- `tcg_catalog_sets` — set index per franchise
- `tcg_catalog_cards` — card rows for search + browse fallback

## 2026-05-27 Known Good Baseline

Treat this as the protected master-catalog spine for Liquid Scan:

- Supabase `tcg_catalog_sets` and `tcg_catalog_cards` are the primary browse and scan-match cache. Live APIs are fallback/refresh sources, not the normal scan-time dependency.
- Pokemon catalog IDs use upstream English IDs such as `base1-4`. These IDs remain the shared identity key for browse, scan candidates, saved identities, cert registry, and market intelligence.
- Print/version variants are materialized as separate synthetic rows only when they represent a distinct PGT product identity:
  - `__unlimited`
  - `__first_edition`
  - `__shadowless`
  - `__reverse_holo`
- Default set browse excludes synthetic variants unless the user or scan explicitly asks for that print/finish, keeping normal set pages clean and fast.
- Scanner matching is DB-first: strict Supabase match, broad Supabase candidates, then bounded live fallback only when DB has no usable answer.
- Matching protects exact catalog hits with set-total/collector-number checks, print-variant agreement, hard-conflict caps, and deterministic tie-breaking.
- Japanese cards keep Japanese language/name/set/printed number on the scan object, but use an English counterpart only as the catalog spine when no dedicated Japanese catalog row exists.

Do not flatten localized Japanese artwork or localized card rows into the base English Pokemon rows. Add them as an overlay or validated synthetic/localized product layer so the current English catalog remains stable.

Localized Japanese artwork now uses `tcg_catalog_localized_artwork` as an overlay. Apply it with:

```bash
npm run db:apply:localized-artwork
```

Validated rows can be dry-run or upserted with:

```bash
npm run catalog:sync:pokemon-japanese-artwork
npm run catalog:sync:pokemon-japanese-artwork -- --apply
```

## Setup checklist (in order)

1. **Apply DB migration:** `npm run db:apply` then `npm run db:verify` (expects `tcg_catalog_sets`, `tcg_catalog_cards`, `tcg_catalog_sources`).
2. **Verify live APIs:** `npm run verify:catalog-live`
3. **Initial cache (optional, speeds DB fallback):** `npm run catalog:sync:all` (Magic is large; start with `npm run catalog:sync:lorcana` for a quick win).
4. **Production cron:** set `CRON_SECRET` on Vercel → redeploy (uses `vercel.json` daily 06:00 UTC).
5. **Smoke (dev server running):** `npm run smoke:catalog`

Browse works **without** step 3 for Magic, Yu-Gi-Oh!, One Piece, and Lorcana (live APIs). DB sync improves scan matching and offline resilience.

## Sync (auto-update new sets/cards)

### Nightly incremental (production)

1. Set `CRON_SECRET` in Vercel Production env.
2. `vercel.json` runs `GET /api/catalog/sync` daily at 06:00 UTC.
3. Incremental logic (`src/lib/catalog/sync/incremental-sync.ts`):
   - Upserts **all set lists** from each source
   - Refreshes **card rows** for sets released in the last ~120 days (Pokémon/Magic) or full JSON dumps (Lorcana)

### Full backfill (local / CI)

```bash
npm run catalog:sync:all      # Magic, Yu-Gi-Oh, Lorcana, One Piece
npm run catalog:sync:magic    # Single franchise
```

Apply DB migration first: `npm run db:apply`

### Weekly GitHub Action

Workflow: `.github/workflows/catalog-sync-weekly.yml` (Sundays 08:00 UTC + manual dispatch).

Repository secrets (Settings → Secrets and variables → Actions):

| Secret | Purpose |
|--------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Upsert `tcg_catalog_*` |
| `POKEMON_TCG_API_KEY` | Optional; faster Pokémon sync |
| `CRON_SECRET` | Optional; matches Vercel daily cron |

### Manual cron test

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://YOUR_DOMAIN/api/catalog/sync
```

## Scan handoff

`CatalogScanPrefill` includes optional `franchise`. **Scan this card** loads a confirmed catalog row into the active scan session.

## Sports

No unified set browser yet. Scan + market hubs (eBay, PriceCharting) remain the path for sports cards.
