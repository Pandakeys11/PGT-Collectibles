# Bright Data — free trial budget ($5 credit)

Bright Data trial includes **~$5 credit** (pay only for **successful** Web Unlocker requests, ~$1.50 per 1,000). Alpha1 enforces local daily caps so you do not burn the trial on backfills.

## Control Panel setup

| Resource | CP name | Env var |
|----------|---------|---------|
| Web Unlocker API | `pgt_web_unlocker` | `BRIGHTDATA_WEB_UNLOCKER_ZONE` |
| Crawl API (PSA pop) | `pgt_psa_pop_crawl` | `BRIGHTDATA_CRAWL_DATASET_ID` |

1. API key → `BRIGHTDATA_API_KEY`
2. Create Web Unlocker zone (see [brightdata-pop-harvest.md](./brightdata-pop-harvest.md))
3. Optional: Crawl dataset for PSA population pages
4. Run `npm run setup:brightdata` then `npm run verify:brightdata`

**eBay note:** If unlocks return empty SERPs, enable **Premium domains** for `ebay.com` in your Unlocker zone (higher CPM, still counts as successful requests).

## Recommended `.env.local` (free tier)

```env
# Daily caps (successful unlocker requests)
BRIGHTDATA_DAILY_REQUEST_BUDGET=60
BRIGHTDATA_EBAY_DAILY_BUDGET=30

# eBay sold — prefer Bright Data while Apify quota is exhausted
EBAY_SOLD_BRIGHTDATA_PRIMARY=1
BRIGHTDATA_UNLOCKER_EBAY_RENDER=1
# Do not set BRIGHTDATA_EBAY_EXPECT_SELECTOR unless Bright Data support recommends it
# (.srp-results + render often returns HTTP 200 with x-brd-status-code 502)
BRIGHTDATA_EBAY_CACHE_HOURS=12

# Reserve Apify for PSA pop only until billing resets
EBAY_SOLD_APIFY=0
```

## Verify

```bash
npm run verify:brightdata
npm run verify:brightdata -- --ebay
npm run verify:ebay-sold
```

Quota state: `.cache/brightdata-unlocker-quota.json`  
eBay HTML cache: `.cache/brightdata-ebay/` (reuses pages within `BRIGHTDATA_EBAY_CACHE_HOURS`)

## What uses unlocker budget

| Bucket | Use | Default daily cap |
|--------|-----|---------------------|
| `ebay` | Completed/sold SERP HTML | 30 |
| `cert` | PSA/BGS cert + pop pages | remainder of 60 total |
| `other` | misc | shared total |

## Pipeline order (when `EBAY_SOLD_BRIGHTDATA_PRIMARY=1`)

1. Bright Data unlocker (max 2 query variants per card, disk cache)
2. Apify sold (if `EBAY_SOLD_APIFY` not `0` and quota OK)
3. eBay Finding API
4. Direct HTML (skipped when primary)

`ebaySoldReady` in market capabilities is true when **any** of Apify, Finding, or Bright Data (with budget) can run.
