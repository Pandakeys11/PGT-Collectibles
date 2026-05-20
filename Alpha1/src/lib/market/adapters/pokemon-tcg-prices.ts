import type { MarketApiAdapter, ApiAdapterResult } from "@/lib/market/adapters/types";
import { matchPokemonCatalog, type CatalogMatch } from "@/lib/market/pokemon-catalog";
import type { ExtractedCard, MarketEvidence } from "@/lib/scan/schemas";

function variantLabel(variant: string): string {
  return variant
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}

function safeDate(updatedAt: string | null): string | null {
  if (!updatedAt) return null;
  // Pokemon TCG returns "YYYY/MM/DD" or sometimes ISO. Normalize to YYYY-MM-DD when plausible.
  const trimmed = updatedAt.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  if (/^\d{4}\/\d{2}\/\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10).replace(/\//g, "-");
  }
  return null;
}

function pushTcgPlayer(catalog: CatalogMatch, evidence: MarketEvidence[]) {
  const url = catalog.prices.tcgPlayerUrl;
  if (!url) return;
  const observedAt = safeDate(catalog.prices.tcgPlayerUpdatedAt);

  for (const variant of catalog.prices.tcgPlayerPrices) {
    const label = variantLabel(variant.variant);
    if (variant.market != null) {
      evidence.push({
        kind: "active",
        title: `${catalog.name} — ${label} (TCGPlayer market)`,
        priceUsd: variant.market,
        observedAt,
        url,
        source: "TCGPlayer",
        slab: null,
      });
    }
    if (variant.low != null) {
      evidence.push({
        kind: "active",
        title: `${catalog.name} — ${label} (TCGPlayer low)`,
        priceUsd: variant.low,
        observedAt,
        url,
        source: "TCGPlayer",
        slab: null,
      });
    }
    if (variant.mid != null) {
      evidence.push({
        kind: "reference",
        title: `${catalog.name} — ${label} (TCGPlayer mid)`,
        priceUsd: variant.mid,
        observedAt,
        url,
        source: "TCGPlayer",
        slab: null,
      });
    }
  }
}

function pushCardMarket(catalog: CatalogMatch, evidence: MarketEvidence[]) {
  const url = catalog.prices.cardMarketUrl;
  const prices = catalog.prices.cardMarket;
  if (!url || !prices) return;
  const observedAt = safeDate(catalog.prices.cardMarketUpdatedAt);

  if (prices.trendPrice != null) {
    evidence.push({
      kind: "reference",
      title: `${catalog.name} (CardMarket trend EUR≈USD)`,
      priceUsd: prices.trendPrice,
      observedAt,
      url,
      source: "CardMarket",
      slab: null,
    });
  }
  if (prices.averageSellPrice != null) {
    evidence.push({
      kind: "sold",
      title: `${catalog.name} (CardMarket avg sell)`,
      priceUsd: prices.averageSellPrice,
      observedAt,
      url,
      source: "CardMarket",
      slab: null,
    });
  }
  if (prices.avg30 != null) {
    evidence.push({
      kind: "sold",
      title: `${catalog.name} (CardMarket 30d avg)`,
      priceUsd: prices.avg30,
      observedAt,
      url,
      source: "CardMarket",
      slab: null,
    });
  }
  if (prices.lowPrice != null) {
    evidence.push({
      kind: "active",
      title: `${catalog.name} (CardMarket low)`,
      priceUsd: prices.lowPrice,
      observedAt,
      url,
      source: "CardMarket",
      slab: null,
    });
  }
}

/**
 * Free price feed: Pokémon TCG API embeds TCGPlayer + CardMarket prices in every card record.
 * Works without any paid keys. POKEMON_TCG_API_KEY is optional for higher rate limits.
 */
export const pokemonTcgPricesAdapter: MarketApiAdapter = {
  id: "pokemon_tcg_prices",
  async collect(card: ExtractedCard): Promise<ApiAdapterResult> {
    const catalog = await matchPokemonCatalog(card);
    if (!catalog) return { adapter: "pokemon_tcg_prices", evidence: [] };

    const evidence: MarketEvidence[] = [];
    pushTcgPlayer(catalog, evidence);
    pushCardMarket(catalog, evidence);

    return { adapter: "pokemon_tcg_prices", evidence };
  },
};
