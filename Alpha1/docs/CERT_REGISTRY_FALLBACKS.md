# Cert registry & population fallbacks

Graded card enrich and Liquid Ask use the same provider chain. **You do not need GemRate or PSA API approval** to ship — configure any layer below.

## Provider order

| # | Provider | Env | Approval / cost |
|---|----------|-----|-----------------|
| 1 | GemRate Partner API | `GEMRATE_API_KEY` | Partner application |
| 2 | PSA Public API | `PSA_API_KEY` or `PSA_API_*` OAuth | **Cert # only** — ~100 calls/day free tier |
| 3 | **Bright Data Crawl / Unlocker** | `BRIGHTDATA_API_KEY` + dataset or zone | Bot-safe PSA/BGS/CGC pages; see `docs/brightdata-pop-harvest.md` |
| 4 | PSA cert page scrape | `PSA_CERT_PAGE_SCRAPE=1` (default) | Free, fast |
| 5 | **Apify PSA Pop Scraper** | `APIFY_API_TOKEN` | Slower (~90s); richer pop if page scrape fails |
| 6 | DuckDuckGo snippets | always | Free, lowest detail |

## Minimum setups (pick one)

### A — Free only (no approvals)

```env
PSA_CERT_PAGE_SCRAPE=1
GEMINI_API_KEY=...   # Liquid Ask web brief
GROQ_API_KEY=...     # streaming answers
```

Graded scans get registry URL + best-effort name/grade/pop from PSA HTML.

### B — Paid fallback without GemRate/PSA

```env
APIFY_API_TOKEN=...
PSA_CERT_PAGE_SCRAPE=1
```

Apify returns structured pop (total, PSA 10, PSA 9) when the actor succeeds.

### C — Official PSA only (cert lookups)

```env
PSA_API_KEY=...   # portal token from psacard.com/publicapi
# or full OAuth:
PSA_API_CLIENT_ID=...
PSA_API_CLIENT_SECRET=...
PSA_API_USERNAME=...
PSA_API_PASSWORD=...
```

**Quota:** app tracks daily usage in `.cache/psa-api-quota.json`. Bulk set population uses **Bright Data**, not PSA API.

### D — Full stack

GemRate + PSA API + Apify + cert page (Apify skipped when 1 or 2 succeed).

## Apify setup (exact steps)

1. Open **https://console.apify.com/account/integrations**
2. Under **Personal API tokens** → **Create token** (not “Actor” ID, not username).
3. Copy the token (usually starts with `apify_api_`).
4. In **Alpha1 `.env.local`** (not only `.env.example`):

```env
APIFY_API_TOKEN=apify_api_xxxxxxxxxxxxxxxxxxxxxxxx
PSA_CERT_PAGE_SCRAPE=1
```

5. Restart dev server (`npm run dev`) so Next.js reloads env.
6. Local smoke test (no server):

```bash
npm run smoke:cert-registry -- 12345678
```

Replace `12345678` with a real PSA cert from a slab you own.

**Common mistakes**

| Wrong | Right |
|-------|--------|
| Token only in `.env.example` | Must be in `.env.local` for local dev |
| `APIFY_ACTOR_ID` or actor URL | Use `APIFY_API_TOKEN` |
| OAuth only when you have a portal token | Use `PSA_API_KEY` or `PSA_API_ACCESS_TOKEN` as Bearer |
| Burning PSA API on catalog backfill | Use Bright Data pop harvest — PSA API has no card-name search on free tier |
| Forgot restart after edit | Restart `npm run dev` |

Actor page (for reference): **https://apify.com/lulzasaur/psa-pop-scraper**

## Health check

Signed in:

```bash
GET /api/market/cert-registry
```

Returns `activeChain` and `capabilities[].configured` without secrets.

## Scan enrich

`POST /api/scan/enrich` calls `hydrateRegistryFromCard()` for **graded** lanes with a readable cert number. Context fields:

- `registryUrl`
- `populationSummary` (from provider `populationNote` or verify message)
- verification uses registry name/grade vs extraction

## Liquid Ask

Cert numbers in the user message still use `lookupCertViaProviders()` (same chain).

## Apify notes

- Actor: `lulzasaur/psa-pop-scraper`
- Disable: `CERT_REGISTRY_APIFY=0`
- Passes your PSA bearer to the actor when OAuth is configured (avoids shared 100/day pool)
- PSA slabs only; BGS/CGC rely on GemRate or web snippets

## Legal

Use population data for **in-app enrichment and links to PSA** — do not republish a full PSA population database as a standalone product.
