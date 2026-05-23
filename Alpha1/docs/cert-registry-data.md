# Cert registry, population, and graded sales — data strategy

PGT Liquid Vault needs **cert → card identity → population → same-grade comps**. PSA does not expose a simple open API key in the way Groq/OpenAI do; use a **tiered provider chain** instead of a single source.

## Recommended stack (best → fallback)

| Priority | Provider | Best for | Access | Notes |
|----------|----------|----------|--------|-------|
| **1** | [GemRate Partner API](https://www.gemrate.com/partner) | **Universal cert lookup** (PSA, BGS, CGC, SGC) + **hybrid population** across graders | Commercial partner (demo / API key) | Single cert endpoint, daily pop updates, `gemrate_id` for population. Best fit for “one integration, all graders.” |
| **2** | [PSA Public API](https://www.psacard.com/publicapi) | Official PSA cert details | PSA Collectors account + OAuth 2 (password grant) | Authoritative for PSA-only; no BGS/CGC. Apply via PSA site; do not embed credentials in client code. |
| **3** | **eBay Finding + sold scrape** (already in repo) | **Recent sold comps** for card + grade | `EBAY_FINDING_APP_ID` / client credentials | Strong for **sales**, weak for population. Cert # rarely appears in titles; use card identity from cert lookup. |
| **4** | **Gemini Google Search grounding** (already in repo) | Fresh snippets when APIs missing | `GEMINI_API_KEY` | Good for “what sold lately”; not a substitute for structured pop tables. |
| **5** | **DuckDuckGo + registry URLs** (current fallback) | Registry links + snippet parsing | No key | Fragile; use only when tiers 1–3 unavailable. |

### What we do **not** rely on as primary

- **Scraping `psacard.com/cert/...` HTML** — breaks on layout changes, ToS risk, no SLA.
- **Card Ladder** — excellent **UI** cert search and 100M+ sales, but **no public developer API** in this repo today. Deep links only (`cardladder-urls.ts`). Enterprise/data deals are separate (e.g. Card Hedge–style partners).
- **ALT / Goldin** — hub links for research; no server keys wired.

### Pokémon-only add-ons (optional)

- [TCGAPIs PSA checker](https://tcgapis.com/psa-checker) — cheap cert verify + limited pop (Pokémon skew).
- PokemonPriceTracker PSA API — large PSA price DB; monthly plans.

Use these as **supplements**, not the core sports/TCG spine.

## What “100% accurate” means in product terms

| Field | Realistic source |
|-------|------------------|
| Cert is valid + card name + grade | GemRate universal cert **or** PSA Public API |
| PSA population by grade | GemRate hybrid pop **or** PSA API population fields |
| Grade date | Registry API / cert page fields |
| Recent sales (same card, same grade) | eBay sold + Card Ladder search URL + Gemini snippets |
| Recent sales (this exact cert) | Rare in titles; Card Ladder cert search (manual/deep link) until sales API partner |

Always show **source + as-of date** in the UI; never imply live PSA pop without an API timestamp.

## Environment variables (when ready)

```env
# Tier 1 — GemRate (contact gemrate.com/partner)
GEMRATE_API_KEY=
GEMRATE_API_BASE_URL=https://api.gemrate.com

# Tier 2 — PSA Public API (Collectors account; OAuth server-side only)
PSA_API_CLIENT_ID=
PSA_API_CLIENT_SECRET=
PSA_API_USERNAME=
PSA_API_PASSWORD=
PSA_API_TOKEN_URL=

# Tier 3 — already configured
EBAY_FINDING_APP_ID=...
GEMINI_API_KEY=...
```

Provider order is controlled in code: `GEMRATE` → `PSA_PUBLIC` → `WEB_SNIPPET` (see `src/lib/market/cert-data-providers/`).

## Implementation in this repo

- `lookupCertViaProviders()` — tries GemRate, then PSA Public API, then existing web snippet lookup.
- Liquid Ask and enrich pass results into `RegistrySnapshot` + `LiquidAskCertLookup`.
- UI: cert block + population line + registry link + comp grid (already in `liquid-ask-response.tsx`).

## Next action for production

1. **Book GemRate demo** — universal cert + hybrid population for Liquid Vault Ask and graded enrich.
2. **Register PSA Public API** with a service account; store OAuth tokens server-side only.
3. Keep **eBay + Gemini** as comp freshness layer on top of structured cert/pop.
