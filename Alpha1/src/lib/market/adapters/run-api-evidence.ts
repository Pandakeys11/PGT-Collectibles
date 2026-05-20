import type { ExtractedCard, MarketEvidence } from "@/lib/scan/schemas";
import { ebayBrowseAdapter } from "@/lib/market/adapters/ebay";
import { ebaySoldScrapeAdapter } from "@/lib/market/adapters/ebay-sold-scrape";
import { pokemonTcgPricesAdapter } from "@/lib/market/adapters/pokemon-tcg-prices";
import { priceChartingAdapter } from "@/lib/market/adapters/pricecharting";

/**
 * 1. Pokémon TCG API (prices)  2. eBay sold (Finding + HTML)  3. eBay Browse (OAuth, active)  4. PriceCharting (token)
 */
const ORDERED_ADAPTERS = [
  pokemonTcgPricesAdapter,
  ebaySoldScrapeAdapter,
  ebayBrowseAdapter,
  priceChartingAdapter,
] as const;

export async function collectApiMarketEvidence(card: ExtractedCard): Promise<MarketEvidence[]> {
  if (process.env.MARKET_FREE_ONLY === "1") {
    // Quick fully-free mode: only run keyless adapters.
    const freeOnly = await Promise.allSettled(
      [pokemonTcgPricesAdapter, ebaySoldScrapeAdapter].map((adapter) => adapter.collect(card)),
    );
    const out: MarketEvidence[] = [];
    for (const result of freeOnly) {
      if (result.status === "fulfilled") out.push(...result.value.evidence);
    }
    return out;
  }

  const settled = await Promise.allSettled(ORDERED_ADAPTERS.map((adapter) => adapter.collect(card)));
  const evidence: MarketEvidence[] = [];
  for (const result of settled) {
    if (result.status === "fulfilled") evidence.push(...result.value.evidence);
  }
  return evidence;
}
