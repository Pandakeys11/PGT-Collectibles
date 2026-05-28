import {
  hasApifyEbaySoldCredentials,
  isApifyEbaySoldConfigured,
} from "@/lib/market/apify-ebay-sold";
import {
  isEbayBrightDataSoldReady,
  isEbaySoldBrightDataEnabled,
} from "@/lib/market/brightdata/ebay-sold-unlocker";
import { isEbayFindingAvailable } from "@/lib/market/ebay-finding-completed";
import { getEbayFindingAppId } from "@/lib/market/env-market";

export { isEbaySoldBrightDataEnabled, isEbayBrightDataSoldReady };

/** @deprecated Use isEbaySoldBrightDataEnabled */
export function isEbaySoldHtmlFallbackReady(): boolean {
  return isEbaySoldBrightDataEnabled();
}

/** Sold comps can run now (Apify, Finding, or Bright Data with budget). */
export function isEbaySoldProductionReady(): boolean {
  return (
    isApifyEbaySoldConfigured() ||
    isEbayFindingAvailable() ||
    isEbayBrightDataSoldReady()
  );
}

export function hasEbaySoldCredentials(): boolean {
  return (
    hasApifyEbaySoldCredentials() ||
    Boolean(getEbayFindingAppId() && process.env.EBAY_DISABLE_FINDING !== "1") ||
    isEbaySoldBrightDataEnabled()
  );
}
