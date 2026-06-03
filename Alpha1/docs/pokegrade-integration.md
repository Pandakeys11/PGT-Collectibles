# PokeGrade live scan (Liquid Scan)

## Camera vs upload parity

All images — **gallery upload**, **Photo** camera capture, and **Live Scan** frames — pass through `prepareScanUploadDataUrl` (resize, EXIF orientation, JPEG compress) before vision. This keeps Android/iOS camera photos under Vercel’s ~4.5MB request limit.

## Camera (mobile + desktop)

The **camera button** opens the **in-app live camera** (`navigator.mediaDevices.getUserMedia`) with the **PGT helmet HUD** overlaid on the preview. This is **not** the native `<input capture>` UI (that is only a fallback if camera permission is denied).

| Control | Behavior |
|---------|----------|
| **Auto** | Scans every ~3s while the visor is open |
| **Scan** | Manual scan now |
| **Snap** | Save frame to upload queue (no vision until Start AI Scan) |
| **Add** | Push last HUD result into the scan sheet |

Requires **HTTPS** (or localhost) for `getUserMedia`.

## Data pipeline (today)

Live Scan uses the **PGT stack** with optional **PokeGrade Engine** hints:

1. `captureLiveScanFrames` — full-frame vision URL + guide crop (same compression as uploads)
2. **Parallel identity** — `runVisionExtraction` + optional `POST /api/pokegrade/grade` (when configured)
3. **Catalog first** — `runCatalogEnrichSession` with `deferMarket: true` → HUD shows match + art quickly
4. **Precision crop** (if weak) runs in parallel with catalog; re-matches when OCR improves
5. **Market async** — `enrichExtractedCard` phase `market` for FMV + comps
6. **Art embedding match** — Gemini vectors vs cached catalog art (`art-match.ts`) when scan crop is available
7. **eBay-style picker** — ambiguous matches show `CatalogMatchQuickPick` in the live result sheet (✓/✗)

Upload / Photo scans use the same catalog + market spine via `runEnrichSessionPipeline`.

## PokeGrade Engine API (optional)

PokeGrade.AI advertises a **Grading Engine API** on [pokegrade.ai](https://pokegrade.ai/) (footer). Public OpenAPI was not available at integration time.

When you receive partner credentials, set:

```env
POKEGRADE_API_URL=https://api.pokegrade.ai   # confirm with PokeGrade
POKEGRADE_API_KEY=
```

Server-side hook: `src/lib/pokegrade/engine-client.ts` (`tryPokeGradeEngine`).

**Proxy route (live camera):** `POST /api/pokegrade/grade` — accepts `{ imageBase64, mimeType }`, returns HUD-shaped identity hints. Called in parallel with vision from `fetchPokeGradeHint` in `hint-client.ts`. Returns 503 when not configured (PGT pipeline continues unchanged).

Expected response shape (adjust to real docs):

```json
{
  "cardName": "Charizard",
  "set": "Base Set · 4/102",
  "grade": "PSA 9",
  "fairValueUsd": 420,
  "psa10Value": 2100
}
```

## Files

| Path | Role |
|------|------|
| `src/lib/scan/prepare-upload-image.ts` | Upload/camera compression |
| `src/lib/pokegrade/live-scan.ts` | Live identity + catalog-first + market |
| `src/lib/pokegrade/hint-client.ts` | Optional PokeGrade parallel hint |
| `src/app/api/pokegrade/grade/route.ts` | Server proxy for PokeGrade Engine |
| `src/lib/pokegrade/hud-from-specimen.ts` | HUD metrics |
| `src/components/scanner-chat/liquid-scan-live-camera.tsx` | Full-screen camera |
| `src/components/scanner-chat/live-scan-result-sheet.tsx` | Match sheet + catalog picker |
| `src/components/scanner-chat/pokegrade-hud-overlay.tsx` | Visor HUD |

## Testing

1. Android Chrome: Photo mode → capture → Start AI Scan (no 413)  
2. Scan mode → allow camera → center one card → HUD shows FMV + PSA 10  
3. **Add to sheet** → row appears in mobile drawer / desktop panel  
4. Desktop: same toggle + live camera when `getUserMedia` is available (HTTPS required)
