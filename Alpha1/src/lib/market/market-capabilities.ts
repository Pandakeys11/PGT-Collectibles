import { getGeminiApiKey } from "@/lib/ai/env";
import { isApifyEbaySoldConfigured } from "@/lib/market/apify-ebay-sold";
import { isApifyPsaPopConfigured } from "@/lib/market/apify-psa-pop";
import { psaPublicApiConfigured } from "@/lib/market/cert-data-providers/psa-api-token";
import { isEbayMarketplaceInsightsConfigured } from "@/lib/market/ebay-marketplace-insights";
import { getEbayClientId, getEbayFindingAppId } from "@/lib/market/env-market";

export type MarketCapabilities = {
  ebayConfigured: boolean;
  ebayFinding: boolean;
  ebayBrowse: boolean;
  apifyEbaySold: boolean;
  ebayInsights: boolean;
  geminiSearch: boolean;
  psaCertPage: boolean;
  gemrate: boolean;
  psaPublicApi: boolean;
  apifyPsa: boolean;
};

export function getMarketCapabilities(): MarketCapabilities {
  return {
    ebayConfigured: Boolean(getEbayFindingAppId() || getEbayClientId() || isApifyEbaySoldConfigured()),
    ebayFinding: Boolean(getEbayFindingAppId()) && process.env.EBAY_DISABLE_FINDING !== "1",
    ebayBrowse: Boolean(getEbayClientId()),
    apifyEbaySold: isApifyEbaySoldConfigured(),
    ebayInsights: isEbayMarketplaceInsightsConfigured(),
    geminiSearch: Boolean(getGeminiApiKey()),
    psaCertPage: process.env.PSA_CERT_PAGE_SCRAPE !== "0",
    gemrate: Boolean(process.env.GEMRATE_API_KEY?.trim()),
    psaPublicApi: psaPublicApiConfigured(),
    apifyPsa: isApifyPsaPopConfigured(),
  };
}

/** One-line summary for UI banners. */
export function marketCapabilitiesSummary(caps: MarketCapabilities): string {
  const parts: string[] = [];
  if (caps.apifyEbaySold) parts.push("eBay sold (Apify)");
  else if (caps.ebayFinding) parts.push("eBay sold (Finding)");
  else if (caps.ebayBrowse) parts.push("eBay listings");
  else if (caps.ebayConfigured) parts.push("eBay");
  else parts.push("eBay (APIFY_API_TOKEN or EBAY_CLIENT_ID)");
  if (caps.ebayInsights) parts.push("Insights (stub)");
  if (caps.geminiSearch) parts.push("live search");
  if (caps.gemrate) parts.push("GemRate");
  if (caps.psaPublicApi) parts.push("PSA API");
  if (caps.apifyPsa) parts.push("Apify PSA");
  if (caps.psaCertPage) parts.push("PSA cert page");
  return parts.join(" · ");
}
