# Liquid Scan Master Catalog Audit

Date: 2026-05-27

## Legacy Build Pattern

The legacy `PGTVision` build used the catalog ID as the system spine:

- `CardCatalogProduct.id` was the canonical card identity, usually the raw upstream ID such as `base1-4`.
- `CardCatalogSet` carried set metadata and totals used during disambiguation.
- `Certification`, `CertIntelMasterCatalog`, and `CertIntelSpecimen` linked graded certs back to the same catalog ID.
- Market comps were filtered through comparable identity rules before they were trusted for FMV.

The important legacy behavior was not just "find a similar card." It required the same card identity, set context, collector number, grade lane, and print variant before market rows could influence price.

## Alpha1 Issues Found

- The live `tcg_catalog_cards` cache was missing Pokemon and Magic rows before repair, so scans were forced into slower live/fallback paths.
- Pokemon sync depended too heavily on Pokemon TCG API card paging, which recently returned intermittent 504 responses.
- Magic sync was too slow because it walked Scryfall set pages rather than using bulk data.
- DB catalog matching normalized `4/102` down to `4`, which let cards such as Base Set `4/102`, Base Set 2 `4/130`, and Celebrations `4/102` compete too closely.
- Market evidence had grade/lane filtering, but it lacked the legacy comparable identity guard for wrong collector numbers or derivative variants.
- Catalog lookup indexes covered basic name/number search but needed scan-time set/name fuzzy indexes for heavier Liquid Scan use.

## Work Completed

- Applied the PGT registry migration and restored the registry tables.
- Backfilled the Supabase catalog cache:
- Pokemon: 23,876 cards, 173 sets (20,324 base rows + 3,552 materialized variant rows).
  - Magic: 40,107 cards, 165 sets.
  - Yu-Gi-Oh: 14,369 cards, 636 sets.
  - One Piece: 2,135 cards, 20 sets.
  - Lorcana: 2,610 cards, 19 sets.
- Changed Pokemon full and incremental sync to use the official `PokemonTCG/pokemon-tcg-data` GitHub data repo for card files.
- Changed Magic full sync to use Scryfall bulk `unique_artwork` by default.
- Updated catalog IDs so Pokemon uses raw IDs like `base1-4`, matching the legacy spine.
- Improved Supabase catalog search to query precise set code/name plus collector number before text-search fallback.
- Hydrated set totals from `tcg_catalog_sets` during DB scoring so `4/102` and `4/130` no longer score as equal card numbers.
- Added market evidence identity filtering:
  - Full collector fraction is strong evidence.
  - Bare `#4` is weak for `4/102`.
  - Wrong fractions such as `5/102` are rejected.
  - Derivative variants such as Evolutions/Celebrations are rejected unless the scanned card itself supports that variant.
- Hardened dense vintage scan handling:
  - Southern Islands roster pages now recover `N/18` identities even when vision only extracts a partial 12+ card subset.
  - PSA-style slab labels such as Base II, Japanese Gym 2, Skyridge, Neo 3, and Topps/Movie Edition are parsed before artwork-based guesses.
  - Non-English slab local numbers are preserved in details but not used as hard English catalog numbers unless they are printed fractions or prefixed promo codes.
  - Pokemon-branded non-TCG collectibles such as Topps, Sealdass, Carddass, Topsun, and Meiji are routed as `other` so regular Pokemon TCG catalog art is not applied.
- Applied DB lookup indexes:
  - `franchise,set_code,card_number`
  - `franchise,card_number,lower(name)`
  - trigram indexes for `name` and `set_name`

## Verification

- `npm run verify:market-identity` passes.
- `npm run verify:slab-labels` passes.
- `npm run verify:card-display` passes.
- `npm run build` passes.
- Live DB schema checks pass through the catalog/registry checks.
- `npm run db:verify` still fails only on the unrelated early-user promo auto-grant check.

## Recommended Next Steps

1. Restart the local/dev deployment so `/api/scan/enrich` uses the new matcher code.
2. Run `npm run smoke:enrich` against the restarted server and confirm `Charizard Base Set 4/102` returns `base1-4`.
3. Add a small catalog health panel in Liquid Scan that shows synced franchise counts and last sync timestamps.
4. Schedule nightly `catalog:sync:pokemon` and weekly `catalog:sync:magic` so the master catalog stays warm without scan-time API dependency.
5. Add per-scan telemetry for `catalogIdentityStatus`, top candidate gap, and rejected evidence count so future regressions are visible immediately.
6. Backfill `pgt_card_identities.catalog_id` for historic saved scans where the session already has a confirmed catalog ID.

## 2026-05-27 Browse + DB Audit Addendum

### What Legacy Did Better

The legacy `PGTVision` catalog browser queried one local catalog spine:

- `CardCatalogSet` for all Pokemon set metadata.
- `CardCatalogProduct` for every card row, joined to the set by `setId`.
- Catalog pages, resolver, market pages, cert registry, and scanner alignment all used that same product ID.
- Browse did not depend on live API calls after seed/hydration.
- Products had explicit variant fields (`sourceCardId`, first edition, shadowless, reverse holo, anchor price, population fields), so browse and market identity stayed attached to the same row.

Alpha1 now has two browse paths:

- Pokemon tab: `PokedexBrowser` -> `/api/pokedex/*` -> DB first, then PokemonTCG API fallback.
- Other TCG tabs: `GenericCatalogBrowser` -> `/api/catalog/*` -> Supabase `tcg_catalog_*`, then live adapter fallback.

That split is the core place where behavior drifted.

### Current DB Health

Live Supabase cache is populated:

- Pokemon: 23,876 cards / 173 sets (including materialized WOTC/e-card print variants and Legendary Collection Reverse Holo rows).
- Magic: 40,107 cards / 165 sets.
- Yu-Gi-Oh: 14,369 cards / 636 sets.
- One Piece: 2,135 cards / 20 sets.
- Lorcana: 2,610 cards / 19 sets.
- Dragon Ball / Sports: no rows.

Representative Pokemon rows are present and usable:

- `base1` Base has 102 card rows.
- `si1` Southern Islands has all 18 card rows.

### Issues Found

1. **Pokemon set search falls back to live API too often.**
   `PokedexBrowser` sends set search as PokemonTCG Lucene syntax, e.g. `name:*base*`. The DB fallback currently passes that literal string to `ILIKE`, so DB search returns no rows. Clean `base` returns expected DB rows; literal `name:*base*` returns none. This makes search slower and less stable.

2. **Pokemon card browse ordering is lexicographic, not collector-number order.**
   Base Set DB cards currently order as `1, 10, 100, 101, 102, 11...`. This makes cards look wrong or missing even when DB rows are present.

3. **Magic browse lists unreleased/empty sets first.**
   Magic set page starts with future sets such as `trk` Star Trek with `card_count = 0` and `actualCards = 0`, so selecting the first visible set shows "No cards loaded." This looks like catalog failure even though populated sets are present.

4. **Yu-Gi-Oh browse set linkage is broken.**
   `tcg_catalog_cards.set_code` stores full card print codes such as `ABPF-EN001`, while `tcg_catalog_sets.code` stores set codes such as `ABPF`. The current card lookup filters `set_code = MAMO`, so top YGO sets show 0 cards even when individual print rows exist under card-level codes.

5. **Generic browse trusts set `card_count` even when actual cached card rows are zero.**
   This creates empty detail views for future/partial sets and makes "cards not loading" look like a UI bug.

6. **Pokemon browse still has live API side work.**
   Rarity counts, variant overlay, and filtered rarity/finish tabs can still call live PokemonTCG endpoints. The DB-first route only covers all-card views.

7. **Catalog metadata counts are recomputed on load.**
   `/api/catalog/franchises` runs exact count queries for every franchise at open time. It works, but a cached source-count field would be closer to legacy instant behavior.

### Verification Performed

- `node scripts/verify-catalog-live.mjs`: all upstream catalog sources reachable.
- `node scripts/audit-catalog-coverage.mjs`: timed out on live Pokemon card fetch, confirming live dependency is a weak point.
- Direct Supabase probe confirmed row counts and sample Pokemon/Magic/YGO set/card mismatches.
- Local dev endpoint smoke showed catalog routes compile and return 200 before the dev process was stopped; DB-level probes are the stronger evidence for content correctness.

### Fix Plan

1. Normalize Pokemon set search before DB lookup: convert `name:*base*` to `base` for DB browse, while keeping Lucene only for live API fallback.
2. Add numeric collector ordering for DB browse (`card_number_numeric`, or SQL expression order by numeric prefix then suffix).
3. Hide or de-prioritize sets with `actualCards = 0` in browse, especially future sets, unless user explicitly searches them.
4. Repair Yu-Gi-Oh set linkage:
   - Store `set_code` as the set prefix (`ABPF`) and `card_number` as full print code (`ABPF-EN001`), or
   - update browse to fall back to `set_name` when `set_code` equality returns zero.
5. Add a catalog health API/check script that verifies:
   - every visible set has at least one card row,
   - top set card counts match actual rows,
   - Pokemon Base/Southern Islands sample rows return in numeric order,
   - YGO known sets return cards.
6. Move Pokemon browse toward the legacy model: make Supabase `tcg_catalog_*` the primary browse source for sets/cards, and use live PokemonTCG only for missing overlays or refresh jobs.

### Implemented Hardening

- Added DB browse search normalization in `src/lib/catalog/db-catalog-browse.ts`, so Lucene-style Pokemon queries like `name:*base*` become plain DB search terms before Supabase lookup.
- Added numeric collector-number sorting for DB card browse. Base Set now returns `1, 2, 3...` instead of `1, 10, 100...`.
- Added visible-set filtering for normal DB browse so empty future placeholder sets no longer lead the catalog.
- Added Yu-Gi-Oh card lookup fallback from set code to set name. Sets such as `MAMO` now return their cached card rows even when card-level `set_code` stores the full print code (`MAMO-EN001`).
- Added `npm run verify:catalog-health` to verify Supabase coverage, Pokemon vintage anchor sets, visible Magic set behavior, and YGO set-name linkage.

### Post-Fix Verification

- `npm run verify:catalog-health` passes:
- Pokemon: 173 sets / 23,876 cards.
  - Magic: 165 sets / 40,107 cards.
  - Yu-Gi-Oh: 636 sets / 14,369 cards.
  - One Piece: 20 sets / 2,135 cards.
  - Lorcana: 19 sets / 2,610 cards.
- `npm run verify:market-identity` passes.
- `npm run verify:slab-labels` passes.
- `npm run build` passes.
- Local route smoke passed:
  - `/api/pokedex/sets?era=vintage&q=name%3A*base*` returns DB-backed results.
  - `/api/pokedex/cards?setId=base1` returns 102 total cards with first card `Alakazam #1`.
  - `/api/pokedex/cards?setId=si1` returns 18 total cards.
  - `/api/catalog/sets?franchise=magic` no longer leads with empty future placeholders.
  - `/api/catalog/cards?franchise=yugioh&setId=MAMO` returns 18 total cards.

## 2026-05-27 Variant Catalog Materialization

Legacy stored important variants as separate catalog products. Alpha1 previously had some UI-only artwork switching, but scan matching still resolved to the base API row. The master catalog now materializes key Pokemon variants directly into `tcg_catalog_cards` using stable synthetic IDs:

- Base Set Unlimited: `base1-{number}__unlimited`
- WOTC/e-card 1st Edition: `{set}-{number}__first_edition`
- WOTC/e-card Shadowless where applicable: `{set}-{number}__shadowless`
- Legendary Collection Reverse Holo: `base6-{number}__reverse_holo`

Each variant row preserves the source/base card in `raw_json.sourceCatalogId`, stores `raw_json.catalogVariantKey`, and has its own image URL. Default set browse excludes synthetic variants unless the caller requests the print/finish variant, so Base Set still loads as 102 default rows while the Unlimited, 1st Edition, Shadowless, and Reverse Holo views return variant-specific rows.

Implemented:

- Added `npm run catalog:sync:pokemon-variants`.
- Seeded 3,442 WOTC/e-card print-variant rows from `catalog-set-overlays.json`.
- Seeded 110 Legendary Collection Reverse Holo rows.
- Added DB browse filtering by variant key.
- Added `/api/pokedex/cards?printingPreset=unlimited`.
- Added `/api/pokedex/cards?finishBucket=reverse_holo`.
- Boosted scan catalog scoring when extracted print stamps/details agree with a DB variant row.
- Capped hard-conflict candidates below the confirmation band when name, number, or print variant disagrees, so wrong-set lookalikes no longer tie exact master-catalog hits.

Verification:

- `npm run verify:catalog-health` now validates Pokemon variant rows.
- Route smoke:
  - Default Base Set: 102 rows, first `base1-1`.
  - Base Unlimited: 102 rows, first `base1-1__unlimited`.
  - Default Legendary Collection: 110 rows, first `base6-1`.
  - Legendary Collection Reverse Holo: 110 rows, first `base6-1__reverse_holo`.
- Scan candidate smoke:
  - `Charizard`, Legendary Collection `3/110`, Reverse Holo -> `base6-3__reverse_holo`, confirmed.
  - `Charizard`, Base Set `4/102`, Unlimited -> `base1-4__unlimited`, confirmed.
  - `Blastoise`, Base Set `2/102`, default -> `base1-2`, confirmed.
  - `Blastoise`, Base Set `2/102`, 1st Edition -> `base1-2__first_edition`, confirmed.
  - `Charizard`, Base Set `4/102`, Shadowless -> `base1-4__shadowless`, confirmed.

## 2026-05-27 Catalog Candidate Speed Fix

The scanner was still able to feel stuck while loading catalog candidates because the option-widening ladder reached live APIs even when Supabase had a strong master-catalog answer. Candidate matching now works DB-first:

- Strict Supabase match runs first.
- Broad Supabase match adds manual-pick options.
- If the DB result is confirmed, has enough usable options, or scores strongly, the route returns immediately.
- Live fallback is only attempted when DB has no usable answer, and it is bounded to 8 seconds.
- Synthetic variant rows are excluded from normal DB queries unless the scan explicitly asks for that print/finish. This prevents plain Base Set cards from becoming ambiguous because `__unlimited` rows are also present.
- Exact DB hits are now protected from false ambiguity by final-score conflict caps and deterministic tie-breaking. A candidate with a wrong collector number, wrong name, or wrong print variant cannot tie a clean exact hit at 100.

Smoke timing after the latest fix:

- Legendary Collection Reverse Holo Charizard -> `base6-3__reverse_holo`, confirmed in about 2.6s.
- Base Set Unlimited Charizard -> `base1-4__unlimited`, confirmed in about 0.3s.
- Plain Base Set Blastoise -> `base1-2`, confirmed in about 0.3s.
- Base Set 1st Edition Blastoise -> `base1-2__first_edition`, confirmed in about 0.3s.
- Base Set Shadowless Charizard -> `base1-4__shadowless`, confirmed in about 1.1s.

## 2026-05-27 Base Set Charizard Art Correction

The uploaded nine-card Charizard page exposed a scanner edge case: bottom-row Base Set Charizards could be extracted with correct visual/name/set context but a bad collector prefix such as `6/102`. Strict catalog search used the bad prefix first, so Expedition Base Set `Charizard 6/165` could become the top preview-art candidate even though it conflicted with `/102`.

Implemented:

- If strict DB search returns a top candidate with a hard name/number/print conflict, the scanner now widens to broad DB search before returning candidates.
- Exact name + exact set + matching denominator can repair an OCR prefix mistake. Example: `Charizard + Base Set + 6/102` now resolves to master catalog `base1-4` and corrects the displayed number to `4/102`.
- `Base` from the upstream Pokemon API is normalized to `Base Set` for catalog candidate display.
- Expedition/Base Set substring collisions are penalized, so `Expedition Base Set` no longer receives set agreement from a plain `Base Set` scan.

Verification:

- `npm run smoke:catalog-candidates` now includes `Base Set Charizard OCR number repair` and confirms `base1-4`.
- Direct route probe returns `base1-4`, `Base Set`, `4/102`, and official `base1/4.png` art instead of Expedition `ecard1/6.png`.
