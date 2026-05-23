# App routing (Liquid Scan)

PGT’s primary app shell is **PGT Liquid Scan** at `/liquid-scan`. The legacy command center UI was removed.

## Primary routes

| Path | Purpose |
|------|---------|
| `/` | Redirect → `/liquid-scan` |
| `/liquid-scan` | AI chat scanner (vision, enrich, market, Ask) |
| `/liquid-scan?panel=catalog` | Master catalog embedded in Liquid Scan |
| `/liquid-scan?panel=companion` | Companion panel |
| `/sign-in`, `/sign-up` | Clerk auth (redirect → `/liquid-scan`) |
| `/saved`, `/profile`, `/usage` | Account & saved cards |

## Legacy redirects

| Legacy path | Behavior (default) |
|-------------|-------------------|
| `/scanner` | Redirect → `/liquid-scan` (`view=catalog` → `?panel=catalog`) |
| `/scanner?view=ai` | Redirect → `/liquid-scan?panel=companion` |
| `/scanner-chat`, `/scanner/chat` | Redirect → `/liquid-scan` |
| `/pokedex` | Redirect → `/liquid-scan?panel=catalog` |
| `/redesign` | Redirect → `/liquid-scan` |

Set `LEGACY_SCANNER_ENABLED=0` to return **HTTP 410** on `/scanner` instead of redirecting (hard deprecation).

## Shared UI modules

Liquid Scan reuses specimen/market panels from `src/components/scan-panels/` (formerly `components/scanner/`). Chat shell lives in `src/components/scanner-chat/`.

## Removed (do not re-add)

- `CollectorCommandCenter` / command center desk UI
- `POST /api/scan/chat`, `POST /api/scan/narrate` (Liquid Ask uses `/api/scan/liquid-chat` + in-process briefs)

## Deploy checklist

- Clerk fallback URLs: `/liquid-scan`
- Smoke: `npm run smoke:stack` — checks `/`, `/liquid-scan`, `/scanner`
- Vercel root directory: `Alpha1`

See also: [vercel-404-fix.md](./vercel-404-fix.md), [liquid-scan-ask.md](./liquid-scan-ask.md)
