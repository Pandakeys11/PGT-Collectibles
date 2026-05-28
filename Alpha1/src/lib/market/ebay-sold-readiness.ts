import {
  hasApifyEbaySoldCredentials,
  isApifyEbaySoldConfigured,
} from "@/lib/market/apify-ebay-sold";
import { isBrightDataUnlockerConfigured } from "@/lib/market/brightdata/config";
import { isEbayFindingAvailable } from "@/lib/market/ebay-finding-completed";
import { getEbayFindingAppId } from "@/lib/market/env-market";

/** Bright Data unlocker for completed-listings HTML when direct fetch is blocked. */
export function isEbaySoldHtmlFallbackReady(): boolean {
  const flag = process.env.EBAY_SOLD_BRIGHTDATA?.trim().toLowerCase();
  if (flag === "0" || flag === "false") return false;
  return isBrightDataUnlockerConfigured();
}

/**
 * Primary sold-comps APIs operational (Apify or Finding).
 * Bright Data HTML is a runtime fallback only — does not count as production-ready alone.
 */
export function isEbaySoldProductionReady(): boolean {
  return isApifyEbaySoldConfigured() || isEbayFindingAvailable();
}

export function hasEbaySoldCredentials(): boolean {
  return (
    hasApifyEbaySoldCredentials() ||
    Boolean(getEbayFindingAppId() && process.env.EBAY_DISABLE_FINDING !== "1") ||
    isEbaySoldHtmlFallbackReady()
  );
}
