# Bright Data population harvest (PSA / BGS / CGC)

Alpha1 uses **Bright Data Crawl API** and/or **Web Unlocker** to fetch grader population pages, parse PSA 10→1 (and BGS/CGC grade rows), and write **`pgt_population_snapshots`** in Supabase.

**Free trial budget:** see [brightdata-free-tier.md](./brightdata-free-tier.md) for daily unlocker caps and eBay sold setup.

## Setup (trial / production)

Bright Data does **not** let trial API keys create zones via API — you create both resources in the **Control Panel**, then paste IDs into `.env.local`.

**Use these exact names** (so the team stays consistent):

| Resource | Name to enter in CP | Env var |
|----------|---------------------|---------|
| Web Unlocker API | `pgt_web_unlocker` | `BRIGHTDATA_WEB_UNLOCKER_ZONE` |
| Crawl API scraper | `pgt_psa_pop_crawl` | `BRIGHTDATA_CRAWL_DATASET_ID` → `gd_…` (assigned by Bright Data) |

1. **API key** — [API keys](https://brightdata.com/cp/setting/users) (already in `.env.local` as `BRIGHTDATA_API_KEY`).

2. **Web Unlocker zone** (~2 min)

   1. [Create API](https://brightdata.com/cp/zones) → **Web Access APIs** → **Create API**
   2. Choose **Web Unlocker API** → Continue
   3. Name: **`pgt_web_unlocker`** (cannot be renamed later)
   4. Add payment method if prompted (trial verification only)
   5. **Add API**

   ```env
   BRIGHTDATA_WEB_UNLOCKER_ZONE=pgt_web_unlocker
   ```

3. **Crawl API dataset** (~3 min)

   1. Open [Crawl API](https://brightdata.com/cp/crawl) → **Create crawler**
   2. Name: **`pgt_psa_pop_crawl`**
   3. Root URL: `https://www.psacard.com/`
   4. Output format: **Markdown**
   5. Save → copy **Dataset ID** (`gd_xxxxxxxx`)

   ```env
   BRIGHTDATA_CRAWL_DATASET_ID=gd_xxxxxxxx
   BRIGHTDATA_CRAWL_OUTPUT_FORMAT=markdown
   ```

4. Run `npm run setup:brightdata` — verifies zone + writes env when probe succeeds.

5. Restart dev server after editing `.env.local`.

## Verify

```bash
npm run verify:brightdata
```

With dev server running:

```bash
# PSA cert → parse pop → DB (needs catalogId to persist rows)
npm run verify:brightdata -- --cert YOUR_PSA_CERT

# Catalog card → PSA pop harvest
npm run verify:brightdata -- --catalog base1-4
```

Or curl the job directly:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "http://localhost:3002/api/jobs/population-harvest?catalogId=base1-4&graders=PSA"

curl -H "Authorization: Bearer $CRON_SECRET" \
  "http://localhost:3002/api/jobs/population-harvest?cert=12345678&grader=PSA&catalogId=base1-4"
```

## Where data lands

| Table | Content |
|-------|---------|
| `pgt_population_snapshots` | One row per `catalog_id` + `grader` + `grade` (e.g. PSA 10 … PSA 1, plus `TOTAL` when parsed) |
| `pgt_slab_registry` | Cert enrich via `brightdata` provider (`population_note`) |

`source` values: `brightdata_unlocker`, `brightdata_crawl`, etc.

## Provider chain (graded enrich)

GemRate → PSA Public API → **Bright Data** → PSA cert HTML → Apify PSA Pop → web snippets.

Disable Bright Data cert lookup: `CERT_REGISTRY_BRIGHTDATA=0`  
Disable nightly catalog pop sidecar: `CATALOG_INGEST_GRADER_POP=0`

## PSA spec ID (full card pop matrix)

When you have a PSA **spec ID** (from Apify/GemRate/cert), pass it for tighter pop report URLs:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "http://localhost:3002/api/jobs/population-harvest?catalogId=base1-4&psaSpecId=306946"
```

## Compliance

Use population data for in-app enrichment and links to official grader sites. Do not republish a full PSA/BGS/CGC population database as a standalone product.
