import { isGeminiServiceEnabled } from "@/lib/ai/env";
import {
  hasApifyEbaySoldCredentials,
  isApifyEbaySoldConfigured,
} from "@/lib/market/apify-ebay-sold";
import { isApifyPsaPopConfigured } from "@/lib/market/apify-psa-pop";
import { psaPublicApiConfigured } from "@/lib/market/cert-data-providers/psa-api-token";
import { isEbayFindingAvailable } from "@/lib/market/ebay-finding-completed";
import {
  hasEbaySoldCredentials,
  isEbaySoldHtmlFallbackReady,
  isEbaySoldProductionReady,
} from "@/lib/market/ebay-sold-readiness";
import { isEbayMarketplaceInsightsConfigured } from "@/lib/market/ebay-marketplace-insights";
import {
  getEbayClientId,
  getEbayClientSecret,
  getEbayFindingAppId,
  isEbayBrowseConfigured,
  isPokeTraceConfigured,
  isPokeTraceWsEnabled,
} from "@/lib/market/env-market";
import { getApifyEbaySoldBlockReason } from "@/lib/market/provider-health";

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
  ebaySoldHtml: boolean;
  ebayInsights: boolean;
  poketraceRest: boolean;
  poketraceWs: boolean;
  geminiSearch: boolean;
  psaCertPage: boolean;
  gemrate: boolean;
  psaPublicApi: boolean;
  apifyPsa: boolean;
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
    if (isEbaySoldHtmlFallbackReady()) {
      gaps.push("Bright Data HTML fallback configured but primary sold APIs are down");
    }
    if (!hasEbaySoldCredentials()) {
      gaps.push("No eBay sold credentials (Apify token or EBAY_FINDING_APP_ID)");
    }
  }

  return {
    ebaySoldReady,
    ebayBrowseReady: isEbayBrowseConfigured(),
    ebayConfigured: ebaySoldReady,
    ebayFinding: isEbayFindingAvailable(),
    apifyEbaySold: isApifyEbaySoldConfigured(),
    apifyEbaySoldCredentials: apifyCreds,
    ebaySoldHtml: isEbaySoldHtmlFallbackReady(),
    ebayInsights: isEbayMarketplaceInsightsConfigured(),
    poketraceRest: isPokeTraceConfigured(),
    poketraceWs: isPokeTraceWsEnabled(),
    geminiSearch: isGeminiServiceEnabled(),
    psaCertPage: process.env.PSA_CERT_PAGE_SCRAPE !== "0",
    gemrate: Boolean(process.env.GEMRATE_API_KEY?.trim()),
    psaPublicApi: psaPublicApiConfigured(),
    apifyPsa: isApifyPsaPopConfigured(),
    ebaySoldGaps: gaps,
  };
}

/** One-line summary for UI banners. */
export function marketCapabilitiesSummary(caps: MarketCapabilities): string {
  const parts: string[] = [];
  if (caps.ebaySoldReady) {
    if (caps.apifyEbaySold) parts.push("eBay sold (Apify)");
    else if (caps.ebayFinding) parts.push("eBay sold (Finding)");
    else if (caps.ebaySoldHtml) parts.push("eBay sold (HTML+unlocker)");
  } else if (caps.ebayBrowseReady) {
    parts.push("eBay listings only (no sold pipeline)");
  } else {
    parts.push("eBay sold not ready");
  }
  if (caps.poketraceRest) parts.push("PokeTrace REST");
  if (caps.poketraceWs) parts.push("PokeTrace WS");
  if (caps.ebayInsights) parts.push("Insights (stub)");
  if (caps.geminiSearch) parts.push("live search");
  if (caps.gemrate) parts.push("GemRate");
  if (caps.psaPublicApi) parts.push("PSA API");
  if (caps.apifyPsa) parts.push("Apify PSA");
  if (caps.psaCertPage) parts.push("PSA cert page");
  return parts.join(" · ");
}
