import { getEbayApiEnv, getEbayClientId, getEbayClientSecret } from "@/lib/market/env-market";
import { buildMarketSearchIdentity } from "@/lib/market/market-search-identity";
import type { ExtractedCard, MarketEvidence } from "@/lib/scan/schemas";

/**
 * eBay Marketplace Insights API (sold items) requires partner approval and a dedicated scope.
 * This module is a stub: enable with EBAY_MARKETPLACE_INSIGHTS_ENABLED=1 once credentials are approved.
 *
 * @see https://developer.ebay.com/api-docs/buy/marketplace-insights/static/overview.html
 */
export function isEbayMarketplaceInsightsConfigured(): boolean {
  if (process.env.EBAY_MARKETPLACE_INSIGHTS_ENABLED !== "1") return false;
  return Boolean(getEbayClientId() && getEbayClientSecret());
}

let insightsStubLogged = false;

function logInsightsStubOnce(): void {
  if (insightsStubLogged || process.env.EBAY_INSIGHTS_DEBUG !== "1") return;
  insightsStubLogged = true;
  console.warn(
    "[ebay-insights] Marketplace Insights enabled but adapter is stubbed — awaiting API scope approval.",
  );
}

/**
 * Placeholder for official sold comps once Marketplace Insights OAuth scope is granted.
 * Returns [] today so enrich never blocks on an unapproved endpoint.
 */
export async function fetchEbayMarketplaceInsightsSold(
  _card: ExtractedCard,
): Promise<MarketEvidence[]> {
  if (!isEbayMarketplaceInsightsConfigured()) return [];

  logInsightsStubOnce();

  const env = getEbayApiEnv();
  const identity = buildMarketSearchIdentity(_card);
  if (process.env.EBAY_INSIGHTS_DEBUG === "1") {
    console.warn("[ebay-insights] stub query", { env, q: identity.ebayPrimary });
  }

  // Future: POST buy/marketplace_insights/v1_beta/item_sales/search with OAuth token
  return [];
}
