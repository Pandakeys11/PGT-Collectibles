import type { ExtractedCard, MarketEvidence } from "@/lib/scan/schemas";
import { inferCardFranchise } from "@/lib/scan/franchise";
import { ebayBrowseAdapter } from "@/lib/market/adapters/ebay";
import { ebaySoldScrapeAdapter } from "@/lib/market/adapters/ebay-sold-scrape";
import { pokemonTcgPricesAdapter } from "@/lib/market/adapters/pokemon-tcg-prices";
import { priceChartingAdapter } from "@/lib/market/adapters/pricecharting";

type MarketAdapter = {
  collect: (card: ExtractedCard) => Promise<{ evidence: MarketEvidence[] }>;
};

/** Sold comps (Apify → Insights → Finding → HTML) before Browse active listings. */
const POKEMON_ADAPTERS: MarketAdapter[] = [
  pokemonTcgPricesAdapter,
  ebaySoldScrapeAdapter,
  ebayBrowseAdapter,
  priceChartingAdapter,
];

/** Non-Pokemon TCG + sports: PriceCharting and eBay cover most categories; skip Pokemon TCG API. */
const GENERAL_ADAPTERS: MarketAdapter[] = [
  priceChartingAdapter,
  ebaySoldScrapeAdapter,
  ebayBrowseAdapter,
];

function adaptersForCard(card: ExtractedCard): MarketAdapter[] {
  return inferCardFranchise(card).isPokemon ? POKEMON_ADAPTERS : GENERAL_ADAPTERS;
}

export async function collectApiMarketEvidence(card: ExtractedCard): Promise<MarketEvidence[]> {
  const adapters = adaptersForCard(card);

  if (process.env.MARKET_FREE_ONLY === "1") {
    const freeOnly = inferCardFranchise(card).isPokemon
      ? [pokemonTcgPricesAdapter, ebaySoldScrapeAdapter]
      : [ebaySoldScrapeAdapter];
    const settled = await Promise.allSettled(freeOnly.map((adapter) => adapter.collect(card)));
    const out: MarketEvidence[] = [];
    for (const result of settled) {
      if (result.status === "fulfilled") out.push(...result.value.evidence);
    }
    return out;
  }

  const settled = await Promise.allSettled(adapters.map((adapter) => adapter.collect(card)));
  const evidence: MarketEvidence[] = [];
  for (const result of settled) {
    if (result.status === "fulfilled") evidence.push(...result.value.evidence);
  }
  return evidence;
}
