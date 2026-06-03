import { isBrightDataUnlockerOperational } from "@/lib/market/brightdata/config";
import { getPriceChartingApiToken } from "@/lib/market/env-market";
import { isPriceChartingSoldScrapeEnabled } from "@/lib/market/pricecharting/config";

export type PriceChartingReadiness = {
  apiReady: boolean;
  soldScrapeEnabled: boolean;
  /** HTML product-page scrape can run (direct or Bright Data unlocker). */
  soldScrapeReady: boolean;
  /** Either REST guide or sold scrape — enough for catalog ingest / FMV backfill. */
  productionReady: boolean;
  gaps: string[];
};

export function getPriceChartingReadiness(): PriceChartingReadiness {
  const apiReady = Boolean(getPriceChartingApiToken());
  const soldScrapeEnabled = isPriceChartingSoldScrapeEnabled();
  const unlocker = isBrightDataUnlockerOperational();
  const soldScrapeReady = soldScrapeEnabled && unlocker;
  const gaps: string[] = [];

  if (!apiReady) {
    gaps.push("PRICECHARTING_API_TOKEN missing — loose/graded guide via REST disabled");
  }
  if (!soldScrapeEnabled) {
    gaps.push("sold scrape disabled (PGT_DISABLE_PRICECHARTING_SOLD or PRICECHARTING_SOLD_SCRAPE=0)");
  } else if (!unlocker) {
    gaps.push("Bright Data unlocker unavailable — set BRIGHTDATA_API_KEY + zone + budget");
  }

  const productionReady = apiReady || soldScrapeReady;

  return {
    apiReady,
    soldScrapeEnabled,
    soldScrapeReady,
    productionReady,
    gaps,
  };
}
