# PokeGrade live scan (Liquid Scan)

## Camera vs upload parity

All images — **gallery upload**, **Photo** camera capture, and **Live Scan** frames — pass through `prepareScanUploadDataUrl` (resize, EXIF orientation, JPEG compress) before vision. This keeps Android/iOS camera photos under Vercel’s ~4.5MB request limit.

## UI modes

| Mode | Behavior |
|------|----------|
| **Photo** | Native camera/file picker → image queue → **Start AI Scan** (batch sheet) |
| **Scan** | `getUserMedia` live camera → PokeGrade visor HUD → auto-scan every ~3.2s → **Add to sheet** |

Preference is stored in `localStorage` (`pgt-liquid-camera-mode`).

## Data pipeline (today)

Live Scan uses the **PGT stack**, not a third-party scrape:

1. `captureVideoFrameToDataUrl` — same compression as uploads  
2. `runVisionExtraction` — card identity  
3. `enrichExtractedCard` — catalog + FMV + comps (incl. PSA 10 bucket)  
4. `buildHudFromSpecimen` — HUD fields (name, FMV, PSA 10 last sold / FMV)

## PokeGrade Engine API (optional)

PokeGrade.AI advertises a **Grading Engine API** on [pokegrade.ai](https://pokegrade.ai/) (footer). Public OpenAPI was not available at integration time.

When you receive partner credentials, set:

```env
POKEGRADE_API_URL=https://api.pokegrade.ai   # confirm with PokeGrade
POKEGRADE_API_KEY=
```

Server-side hook: `src/lib/pokegrade/engine-client.ts` (`tryPokeGradeEngine`). Add a route proxy (e.g. `/api/pokegrade/grade`) and call it from `runLiveCardScan` before falling back to PGT.

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
| `src/lib/pokegrade/live-scan.ts` | Single-frame vision + enrich |
| `src/lib/pokegrade/hud-from-specimen.ts` | HUD metrics |
| `src/components/scanner-chat/liquid-scan-live-camera.tsx` | Full-screen camera |
| `src/components/scanner-chat/pokegrade-hud-overlay.tsx` | Visor HUD |

## Testing

1. Android Chrome: Photo mode → capture → Start AI Scan (no 413)  
2. Scan mode → allow camera → center one card → HUD shows FMV + PSA 10  
3. **Add to sheet** → row appears in mobile drawer / desktop panel  
4. Desktop: same toggle + live camera when `getUserMedia` is available (HTTPS required)
