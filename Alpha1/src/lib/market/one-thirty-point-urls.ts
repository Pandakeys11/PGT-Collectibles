import type { ExtractedCard } from "@/lib/scan/schemas";
import { buildMarketSearchIdentity } from "@/lib/market/market-search-identity";

/** Multi-marketplace sold search (eBay, Goldin, PWCC, Heritage, etc.). */
export const ONE_THIRTY_POINT_CARDS_BASE = "https://130point.com/cards/";

/**
 * Deep link into 130 Point sold history for a card identity string.
 * The site is a client-rendered search UI; `search` is passed when the page reads URL params.
 */
export function build130PointSoldSearchUrl(query: string): string {
  const q = query.trim().replace(/\s+/g, " ");
  if (!q) return ONE_THIRTY_POINT_CARDS_BASE;
  const params = new URLSearchParams({ search: q });
  return `${ONE_THIRTY_POINT_CARDS_BASE}?${params.toString()}`;
}

/** Search string aligned with eBay / hub identity (name, set, grade). */
export function oneThirtyPointSoldSearchQuery(card: ExtractedCard): string {
  const id = buildMarketSearchIdentity(card);
  return id.graded || id.raw;
}
