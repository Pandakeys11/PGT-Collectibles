import type { MarketApiAdapter, ApiAdapterResult } from "@/lib/market/adapters/types";
import { harvestPriceChartingSoldEvidence } from "@/lib/market/pricecharting/harvest-sold";
import type { ExtractedCard } from "@/lib/scan/schemas";

/** Completed auctions from PriceCharting product pages (best last-sold coverage for raw/modern). */
export const priceChartingSoldScrapeAdapter: MarketApiAdapter = {
  id: "pricecharting_sold",
  async collect(card: ExtractedCard): Promise<ApiAdapterResult> {
    const harvest = await harvestPriceChartingSoldEvidence(card);
    const warnings: string[] = [];
    if (harvest.compsCount === 0) {
      warnings.push("PriceCharting sold scrape returned no completed auctions for this card.");
    }
    return {
      adapter: "pricecharting_sold",
      evidence: harvest.evidence,
      warnings,
    };
  },
};
