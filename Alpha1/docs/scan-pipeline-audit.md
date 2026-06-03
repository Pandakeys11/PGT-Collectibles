# Liquid Scan pipeline audit (vision → catalog → market)

This document summarizes how PGT Liquid Scan works today, known failure modes, **Speed on vs off**, and the enhancements applied to improve match accuracy and perceived speed.

## Pipeline overview

```mermaid
flowchart LR
  A[Upload / camera] --> B[Vision extract]
  B --> C[Build specimens]
  C --> D[Catalog enrich]
  D --> E[Deep catalog if weak]
  E --> F[Market enrich]
  F --> G[Precision crop optional]
  G --> H[Re-enrich catalog + market]
```

| Stage | What it does | Typical latency drivers |
|-------|----------------|-------------------------|
| **Vision** | Groq → OpenRouter → Gemini chain; binder grid uses tiled crops | Image size, provider quota, `VISION_CONCURRENCY` |
| **Catalog** | Supabase `tcg_catalog_cards` cache → live franchise API → merged candidates | Pokémon TCG API, DB sync coverage, parallel enrich count |
| **Deep catalog** | `suggestCatalogCandidates` when fast path returns 0–few options | Extra API round-trip per weak row |
| **Market** | Sold comps / FMV research | eBay/Apify, registry cert harvest |
| **Precision crop** | Second vision pass on tight crop for weak name/set/# | +1 vision credit per row (capped) |

## Speed on vs Speed off

Settings live in `src/lib/scan/liquid-scan-speed.ts` (persisted in `localStorage` as `pgt-liquid-scan-speed-on`).

| Setting | Speed **ON** | Speed **OFF** |
|---------|--------------|---------------|
| Vision parallelism | 2 images at once | 1 (sequential) |
| Catalog/market parallelism | 5 / 4 (boosted for 12+ cards) | 3 / 3 |
| Precision crop cap | 5 rows | 6 rows |
| Bulk registry | Always for graded + cert | Skipped for **raw/binder only**; graded slabs with cert still hydrate |
| Auto session report | Yes | No |

### Why Speed ON felt *less* accurate (root causes)

1. **API thrashing** — Previously Speed ON used very high catalog/market concurrency (8/6). That increased timeouts and partial enrich failures, leaving rows without candidates or art.
2. **Race: deep catalog vs market** — Weak rows fired a background deep catalog search while market enrich started immediately from stale catalog context. Market and thumbnails could be wrong until a manual refresh.
3. **Precision crop wiped catalog** — Background precision pass replaced the whole `ScanCardContext` with an empty context before re-enrich finished, causing a flash of wrong/missing art.
4. **Strict catalog art gate** — Official art only appeared when identity was “authoritative” (confirmed or high-confidence likely). Review rows showed scan crop or placeholder even when good candidates existed.

### Batch enrich (2026-05-28)

Liquid Scan bulk enrich uses **`POST /api/scan/enrich-batch`** via `runEnrichSessionPipeline` (`src/lib/scan/enrich-session-pipeline.ts`):

- One HTTP request per catalog/market **chunk** (not per card).
- Rows with strong vision identity (`name` + `set` + `#`) use **`phase: full`** in a single batch call (catalog + market together).
- Failed batch rows fall back to single `/api/scan/enrich`; catalog failures still try `catalog-candidates`.
- Client: `enrichExtractedCardsBatch` in `enrich-client.ts` (chunks of 24, retries, phase-scaled timeout).

Manual resync, precision crop re-enrich, and per-row market refresh still use single `/api/scan/enrich`.

### Deferred market + lazy registry (2026-05-28)

- **Catalog first, market async** — After catalog+widen, `enriching` clears so the sheet is interactive; `marketEnriching` runs comps in the background.
- **`/api/scan/enrich`** — Thin wrapper around `runEnrichForSpecimen` (same logic as batch).
- **Speed ON** — `skipRegistryOnBulkEnrich: true`; graded slabs hydrate when selected via `/api/scan/registry`.

### Fixes applied (2026-05)

- Rebalanced Speed ON to moderate parallelism (fewer failed enrich calls).
- **Await** deep catalog search before market for weak rows.
- Precision crop updates **card only** until catalog+market re-enrich completes.
- **Preview art** from top catalog candidate while status is still “Needs review”.
- **Registry-before-catalog** for graded slabs with cert (PSA/CGC/etc.) so catalog search uses verified holder name when vision OCR is weak.
- Graded slabs with cert **always** run registry during bulk enrich (even when Speed OFF skips registry for raw pages).

## Catalog matching & “verified” behavior

Identity is **fail-closed**:

- Only `confirmed` (or trusted graded-slab `likely`) merges vision fields and locks `catalogId`.
- `ambiguous` / `failed` keep vision text but show **catalog candidates** for manual ✓/✗ in the carousel and composer.

**Authoritative art** (`resolveCatalogImageUrl`) — strict; used when we trust the match.

**Preview art** (`resolveCatalogPreviewImageUrl`) — shows best candidate thumbnail during review without claiming verification.

### Master catalog backend

| Layer | Source |
|-------|--------|
| Fast path | `tcg_catalog_cards` in Supabase (run catalog sync — see `docs/master-catalog.md`) |
| Pokémon live | TCG API + TCGdex aliases |
| Other franchises | Scryfall, YGOPro, etc. |
| Manual widen | `POST /api/scan/catalog-candidates` |

If `tcg_catalog_cards` is empty or stale, matching is slower and noisier because every row hits live APIs.

## Extraction accuracy (vision)

- **Graded mode** (`laneMode === "graded"`) — `gradedFocus` prompt; label OCR is source of truth (`docs/graded-slab-scan.md`).
- **Binder grid** — tiled vision; weakest rows selected for precision crop.
- **Precision crop** — only fills *missing* name/set/number; does not overwrite strong full-page reads.

Improve extraction quality:

1. Straight-on photos, label fully in frame (slabs).
2. Set `VISION_SKIP_PROVIDERS` if one provider is rate-limited.
3. Ensure `tcg_catalog` sync is current for your main franchise.

## Operational checklist

- [ ] Supabase `tcg_catalog_cards` synced for Pokémon (and other franchises you sell)
- [ ] `VISION_PROVIDER_TIMEOUT_MS` ≥ 120000 for large binder pages
- [ ] Test same slab with Speed on/off after deploy — art should appear during review, not only after confirm
- [ ] PSA cert visible or entered — registry path improves catalog name

## Evidence crop (vision frame) fixes

If users adjust **80–90%** of crops, typical causes were:

1. **0–1 vs 0–1000 coordinates** — Models sometimes return `bbox` or `location` as fractions; we now scale to the 0–1000 grid.
2. **Center-only framing** — Crops used a fixed radius around `[y,x]` instead of the vision **bbox** rectangle.
3. **Missing bbox on compact prompts** — Compact vision retries omitted `bbox`; prompts now require bbox on all passes.

**Current behavior:** When vision returns a valid `bbox`, the UI and resync pipeline crop to that rectangle (with padding). Center+radius is fallback only. Graded slabs use a taller default window when bbox is absent.

Files: `src/lib/scan/spatial-grid.ts`, `src/lib/scan/specimen-crop.ts`, `src/lib/ai/vision-prompts.ts`.

## Recommended next investments

1. **Cert → catalogId cache** — Persist PSA/GemRate identity → `tcg_catalog_cards.catalog_id` in `pgt_slab_registry` for instant art on repeat certs.
2. **Visual embedding match** — Gemini `gemini-embedding-001` vectors cached in `tcg_catalog_art_embeddings`; scan crop compared at enrich time (`src/lib/catalog/art-match.ts`). Backfill: `node scripts/backfill-catalog-art-embeddings.mjs --franchise=pokemon --limit=500`.
3. **Single enrich endpoint** — Combine catalog + market (+ registry) server-side with one round-trip per card to cut UI latency in half.
4. **Catalog sync health dashboard** — Surface last sync time / row count in Liquid Scan so ops knows when DB is stale.
