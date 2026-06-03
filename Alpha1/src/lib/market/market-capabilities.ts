import { isGeminiServiceEnabled } from "@/lib/ai/env";
import {
  hasApifyEbaySoldCredentials,
  isApifyEbaySoldConfigured,
} from "@/lib/market/apify-ebay-sold";
import { isApifyPsaPopConfigured } from "@/lib/market/apify-psa-pop";
import { psaPublicApiConfigured } from "@/lib/market/cert-data-providers/psa-api-token";
import { isEbayFindingAvailable } from "@/lib/market/ebay-finding-completed";
import { isEbayBrightDataSoldReady } from "@/lib/market/brightdata/ebay-sold-unlocker";
import { getBrightDataQuotaSnapshot } from "@/lib/market/brightdata/quota";
import {
  hasEbaySoldCredentials,
  isEbaySoldBrightDataEnabled,
  isEbaySoldProductionReady,
} from "@/lib/market/ebay-sold-readiness";
import { isEbayMarketplaceInsightsConfigured } from "@/lib/market/ebay-marketplace-insights";
import {
  getEbayClientId,
  getEbayClientSecret,
  getEbayFindingAppId,
  isEbayBrowseConfigured,
  isJustTcgConfigured,
  isPokeTraceConfigured,
  isPokeTraceWsEnabled,
} from "@/lib/market/env-market";
import { getPriceChartingReadiness } from "@/lib/market/pricecharting/readiness";
import { isPriceChartingSoldScrapeEnabled } from "@/lib/market/pricecharting/config";
import { getApifyEbaySoldBlockReason } from "@/lib/market/provider-health";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

export type MarketCapabilities = {
  /** Sold comps pipeline can run (Apify, Finding, or Bright Data HTML). */
  ebaySoldReady: boolean;
  /** OAuth Browse API (active listings — not sold history). */
  ebayBrowseReady: boolean;
  /** @deprecated Use ebaySoldReady — same value, honest naming. */
  ebayConfigured: boolean;
  ebayFinding: boolean;
  apifyEbaySold: boolean;
  apifyEbaySoldCredentials: boolean;
  ebaySoldBrightData: boolean;
  brightDataQuotaRemaining: number;
  ebayInsights: boolean;
  poketraceRest: boolean;
  poketraceWs: boolean;
  justTcg: boolean;
  /** PGT-owned US 7d/30d trends (comps + price ticks in Supabase). */
  pgtUsTrends: boolean;
  geminiSearch: boolean;
  psaCertPage: boolean;
  gemrate: boolean;
  psaPublicApi: boolean;
  apifyPsa: boolean;
  priceChartingSoldScrape: boolean;
  priceChartingApi: boolean;
  /** Sold scrape + unlocker (completed auctions on product pages). */
  priceChartingSoldReady: boolean;
  priceChartingReady: boolean;
  priceChartingGaps: string[];
  /** Human-readable gaps when credentials exist but paths are down. */
  ebaySoldGaps: string[];
};

export function getMarketCapabilities(): MarketCapabilities {
  const ebaySoldReady = isEbaySoldProductionReady();
  const apifyCreds = hasApifyEbaySoldCredentials();
  const gaps: string[] = [];

  if (!ebaySoldReady) {
    if (apifyCreds && !isApifyEbaySoldConfigured()) {
      const reason = getApifyEbaySoldBlockReason();
      gaps.push(reason ?? "Apify eBay sold temporarily unavailable");
    }
    if (getEbayFindingAppId() && !isEbayFindingAvailable()) {
      gaps.push("eBay Finding API in cooldown (rate limit)");
    }
    if (isEbaySoldBrightDataEnabled() && !isEbayBrightDataSoldReady()) {
      const q = getBrightDataQuotaSnapshot();
      gaps.push(`Bright Data daily budget used (${q.remainingTotal}/${q.dailyBudget} left)`);
    }
    if (!hasEbaySoldCredentials()) {
      gaps.push("No eBay sold credentials (Apify token or EBAY_FINDING_APP_ID)");
    }
  }

  const pc = getPriceChartingReadiness();

  return {
    ebaySoldReady,
    ebayBrowseReady: isEbayBrowseConfigured(),
    ebayConfigured: ebaySoldReady,
    ebayFinding: isEbayFindingAvailable(),
    apifyEbaySold: isApifyEbaySoldConfigured(),
    apifyEbaySoldCredentials: apifyCreds,
    ebaySoldBrightData: isEbayBrightDataSoldReady(),
    brightDataQuotaRemaining: getBrightDataQuotaSnapshot().remainingTotal,
    ebayInsights: isEbayMarketplaceInsightsConfigured(),
    poketraceRest: isPokeTraceConfigured(),
    poketraceWs: isPokeTraceWsEnabled(),
    justTcg: isJustTcgConfigured(),
    pgtUsTrends: isSupabaseConfigured(),
    geminiSearch: isGeminiServiceEnabled(),
    psaCertPage: process.env.PSA_CERT_PAGE_SCRAPE !== "0",
    gemrate: Boolean(process.env.GEMRATE_API_KEY?.trim()),
    psaPublicApi: psaPublicApiConfigured(),
    apifyPsa: isApifyPsaPopConfigured(),
    priceChartingSoldScrape: isPriceChartingSoldScrapeEnabled(),
    priceChartingApi: pc.apiReady,
    priceChartingSoldReady: pc.soldScrapeReady,
    priceChartingReady: pc.productionReady,
    priceChartingGaps: pc.gaps,
    ebaySoldGaps: gaps,
  };
}

/** One-line summary for UI banners. */
export function marketCapabilitiesSummary(caps: MarketCapabilities): string {
  const parts: string[] = [];
  if (caps.ebaySoldReady) {
    if (caps.apifyEbaySold) parts.push("eBay sold (Apify)");
    else if (caps.ebayFinding) parts.push("eBay sold (Finding)");
    else if (caps.ebaySoldBrightData) parts.push("eBay sold (Bright Data)");
  } else if (caps.ebayBrowseReady) {
    parts.push("eBay listings only (no sold pipeline)");
  } else {
    parts.push("eBay sold not ready");
  }
  if (caps.pgtUsTrends) parts.push("PGT US trends");
  if (caps.poketraceRest) parts.push("PokeTrace REST");
  if (caps.poketraceWs) parts.push("PokeTrace WS");
  if (caps.ebayInsights) parts.push("Insights (stub)");
  if (caps.priceChartingApi) parts.push("PriceCharting API");
  if (caps.priceChartingSoldReady) parts.push("PriceCharting sold scrape");
  else if (caps.priceChartingSoldScrape) parts.push("PriceCharting scrape (no unlocker)");
  if (caps.geminiSearch) parts.push("live search");
  if (caps.gemrate) parts.push("GemRate");
  if (caps.psaPublicApi) parts.push("PSA API");
  if (caps.apifyPsa) parts.push("Apify PSA");
  if (caps.psaCertPage) parts.push("PSA cert page");
  return parts.join(" · ");
}
