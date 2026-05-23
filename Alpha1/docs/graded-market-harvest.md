# Graded market harvest (no GemRate)

PGT’s **production path without GemRate** is not “scrape Card Ladder’s database.” Card Ladder and ALT are **SPA apps** with login walls — bulk HTML crawl will break and may violate ToS. The sharp approach:

## What actually works (ranked)

| Layer | Source | Method | Delivers |
|-------|--------|--------|----------|
| **A** | **eBay** | Finding API + completed-listings HTML scrape (in repo) | Last solds, many live BIN/auction listings, all graders in title |
| **B** | **Card Ladder / ALT / Goldin** | `site:domain` DuckDuckGo + Gemini grounding | Snippet prices + URLs surfaced in comps; **hub links** open full sales UI |
| **C** | **PSA cert page** | Server fetch `psacard.com/cert/{n}/psa` | Card name, grade, pop hints (public page HTML) |
| **D** | **Registry links** | Built URLs | User one-click verify on PSA/CGC/BGS |

## What not to do

- **Do not** pretend DDG snippets = Card Ladder’s 100M sale DB.
- **Do not** run headless browsers against Card Ladder/ALT at scale without a contract.
- **Do not** ship GemRate-shaped accuracy until you have GemRate or PSA Public API OAuth.

## User-facing truth (product copy)

- **Comps in chat** = eBay sold rows + search snippets (dated, sourced).
- **Deep sales history** = “Open Card Ladder” / “Open ALT” / “Open eBay sold” hub buttons.
- **Population** = PSA cert page parse when available; otherwise “verify on registry.”

## Env (you already have)

```env
EBAY_FINDING_APP_ID=...   # or EBAY_CLIENT_ID
EBAY_CLIENT_SECRET=...
GEMINI_API_KEY=...        # optional: finds fresh CL/ALT/eBay pages via Google Search
```

## Code entry points

- `harvestGradedMarketEvidence()` — graded lane + cert-aware queries
- `collectGradedPlatformSnippets()` — Card Ladder, ALT, eBay site searches
- `psaCertPageProvider` — cert metadata without API
- Liquid Ask + `researchCardMarket` call harvest automatically

## When GemRate arrives

Insert before PSA page provider in `cert-data-providers/index.ts`; keep eBay + hub links unchanged.

## Production checklist

1. Set `EBAY_FINDING_APP_ID` or `EBAY_CLIENT_ID` + `EBAY_CLIENT_SECRET` on Vercel.
2. Keep `GEMINI_API_KEY` for supplemental Card Ladder / ALT discovery when eBay rows are thin.
3. Keep `PSA_CERT_PAGE_SCRAPE=1` for cert metadata without GemRate.
4. Liquid Ask UI order: data banner → platform hubs → AI answer → eBay comps → search highlights.
