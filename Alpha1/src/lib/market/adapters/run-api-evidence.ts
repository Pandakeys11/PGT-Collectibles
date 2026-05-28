import type { ExtractedCard, MarketEvidence } from "@/lib/scan/schemas";
import { inferCardFranchise } from "@/lib/scan/franchise";
import { isPokeTraceConfigured, isPokeTracePrimary } from "@/lib/market/env-market";
import { ebayBrowseAdapter } from "@/lib/market/adapters/ebay";
import { ebaySoldScrapeAdapter } from "@/lib/market/adapters/ebay-sold-scrape";
import { pokemonTcgPricesAdapter } from "@/lib/market/adapters/pokemon-tcg-prices";
import { poketraceAdapter } from "@/lib/market/adapters/poketrace";
import { priceChartingAdapter } from "@/lib/market/adapters/pricecharting";
import { pokeTraceCoversTcgPrices } from "@/lib/market/poketrace/sync-catalog";

type MarketAdapter = {
  collect: (card: ExtractedCard) => Promise<{ evidence: MarketEvidence[] }>;
};

const POKEMON_SECONDARY: MarketAdapter[] = [
  ebaySoldScrapeAdapter,
  ebayBrowseAdapter,
  priceChartingAdapter,
];

function countPokeTraceEvidence(rows: MarketEvidence[]): number {
  return rows.filter((row) => row.source === "PokeTrace").length;
}

async function collectPokemonMarketEvidence(card: ExtractedCard): Promise<MarketEvidence[]> {
  const evidence: MarketEvidence[] = [];

  if (isPokeTraceConfigured()) {
    const pt = await poketraceAdapter.collect(card);
    evidence.push(...pt.evidence);
  }

  const skipTcg =
    isPokeTracePrimary() && pokeTraceCoversTcgPrices(countPokeTraceEvidence(evidence));

  if (!skipTcg) {
    const tcg = await pokemonTcgPricesAdapter.collect(card);
    evidence.push(...tcg.evidence);
  }

  const settled = await Promise.allSettled(
    POKEMON_SECONDARY.map((adapter) => adapter.collect(card)),
  );
  for (const result of settled) {
    if (result.status === "fulfilled") evidence.push(...result.value.evidence);
  }

  return evidence;
}

/** Non-Pokemon TCG + sports: PriceCharting and eBay cover most categories; skip Pokemon TCG API. */
const GENERAL_ADAPTERS: MarketAdapter[] = [
  priceChartingAdapter,
  ebaySoldScrapeAdapter,
  ebayBrowseAdapter,
];

function adaptersForCard(card: ExtractedCard): MarketAdapter[] | "pokemon_pipeline" {
  return inferCardFranchise(card).isPokemon ? "pokemon_pipeline" : GENERAL_ADAPTERS;
}

export async function collectApiMarketEvidence(card: ExtractedCard): Promise<MarketEvidence[]> {
  const adapters = adaptersForCard(card);

  if (adapters === "pokemon_pipeline") {
    if (process.env.MARKET_FREE_ONLY === "1") {
      const freeOnly: MarketAdapter[] = [poketraceAdapter, ebaySoldScrapeAdapter];
      if (!isPokeTracePrimary() || !isPokeTraceConfigured()) {
        freeOnly.unshift(pokemonTcgPricesAdapter);
      }
      const settled = await Promise.allSettled(freeOnly.map((adapter) => adapter.collect(card)));
      const out: MarketEvidence[] = [];
      for (const result of settled) {
        if (result.status === "fulfilled") out.push(...result.value.evidence);
      }
      return out;
    }
    return collectPokemonMarketEvidence(card);
  }

  if (process.env.MARKET_FREE_ONLY === "1") {
    const freeOnly = [ebaySoldScrapeAdapter];
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
