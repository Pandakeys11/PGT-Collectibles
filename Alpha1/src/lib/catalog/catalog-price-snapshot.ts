import type { CatalogPriceSnapshot } from "@/lib/market/pokemon-catalog";

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Uniform `prices_json` shape from Pokémon TCG API v2 card (or embed). */
export function priceSnapshotFromPokemonApiCard(card: {
  tcgplayer?: {
    url?: string;
    updatedAt?: string;
    prices?: Record<
      string,
      { market?: number; mid?: number; low?: number; high?: number; directLow?: number }
    >;
  };
  cardmarket?: {
    url?: string;
    updatedAt?: string;
    prices?: {
      averageSellPrice?: number;
      trendPrice?: number;
      lowPrice?: number;
      avg7?: number;
      avg30?: number;
      reverseHoloTrend?: number;
    };
  };
}): CatalogPriceSnapshot {
  const tp = card.tcgplayer;
  const tcgPlayerPrices = tp?.prices
    ? Object.entries(tp.prices).map(([variant, block]) => ({
        variant,
        market: asNumber(block.market),
        mid: asNumber(block.mid),
        low: asNumber(block.low),
        high: asNumber(block.high),
        directLow: asNumber(block.directLow),
      }))
    : [];

  const cm = card.cardmarket?.prices;
  const cardMarket = cm
    ? {
        averageSellPrice: asNumber(cm.averageSellPrice),
        trendPrice: asNumber(cm.trendPrice),
        lowPrice: asNumber(cm.lowPrice),
        avg7: asNumber(cm.avg7),
        avg30: asNumber(cm.avg30),
        reverseHoloTrend: asNumber(cm.reverseHoloTrend),
      }
    : null;

  return {
    tcgPlayerUrl: tp?.url ?? null,
    tcgPlayerUpdatedAt: tp?.updatedAt ?? null,
    tcgPlayerPrices,
    cardMarketUrl: card.cardmarket?.url ?? null,
    cardMarketUpdatedAt: card.cardmarket?.updatedAt ?? null,
    cardMarket,
    priceChartingLooseUsd: null,
    priceChartingUrl: null,
    priceChartingUpdatedAt: null,
  };
}

export function priceSnapshotToPricesJson(
  snapshot: CatalogPriceSnapshot,
): Record<string, unknown> {
  return {
    tcgPlayerUrl: snapshot.tcgPlayerUrl,
    tcgPlayerUpdatedAt: snapshot.tcgPlayerUpdatedAt,
    tcgPlayerPrices: snapshot.tcgPlayerPrices,
    cardMarketUrl: snapshot.cardMarketUrl,
    cardMarketUpdatedAt: snapshot.cardMarketUpdatedAt,
    cardMarket: snapshot.cardMarket,
    priceChartingLooseUsd: snapshot.priceChartingLooseUsd,
    priceChartingUrl: snapshot.priceChartingUrl,
    priceChartingUpdatedAt: snapshot.priceChartingUpdatedAt,
    priceChartingPsa10Usd: snapshot.priceChartingPsa10Usd ?? null,
    priceChartingPsa10Url: snapshot.priceChartingPsa10Url ?? null,
    priceChartingPsa10UpdatedAt: snapshot.priceChartingPsa10UpdatedAt ?? null,
    priceChartingPsa9Usd: snapshot.priceChartingPsa9Usd ?? null,
    priceChartingPsa8Usd: snapshot.priceChartingPsa8Usd ?? null,
    pokeTrace: snapshot.pokeTrace ?? null,
  };
}

export function snapshotHasTcgMarketPrices(snapshot: CatalogPriceSnapshot | null | undefined): boolean {
  if (!snapshot?.tcgPlayerPrices?.length) return false;
  return snapshot.tcgPlayerPrices.some(
    (r) => r.market != null || r.mid != null || r.low != null,
  );
}

/** GitHub static card + optional live API card → stored prices_json. */
export function pricesJsonForPokemonCatalogCard(
  staticCard: { id?: string; tcgplayer?: { url?: string } },
  apiCard?: Parameters<typeof priceSnapshotFromPokemonApiCard>[0] | null,
): Record<string, unknown> {
  const fromApi = apiCard ? priceSnapshotFromPokemonApiCard(apiCard) : null;
  if (fromApi && snapshotHasTcgMarketPrices(fromApi)) {
    return priceSnapshotToPricesJson(fromApi);
  }
  const url = apiCard?.tcgplayer?.url ?? staticCard.tcgplayer?.url ?? null;
  if (url) {
    return { tcgPlayerUrl: url };
  }
  return {};
}
