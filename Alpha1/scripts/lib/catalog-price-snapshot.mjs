/**
 * Uniform catalog prices_json — mirrors src/lib/catalog/catalog-price-snapshot.ts
 */

export function priceSnapshotFromPokemonApiCard(card) {
  const tp = card?.tcgplayer;
  const tcgPlayerPrices = tp?.prices
    ? Object.entries(tp.prices).map(([variant, block]) => ({
        variant,
        market: block?.market ?? null,
        mid: block?.mid ?? null,
        low: block?.low ?? null,
        high: block?.high ?? null,
        directLow: block?.directLow ?? null,
      }))
    : [];

  const cm = card?.cardmarket?.prices;
  const cardMarket = cm
    ? {
        averageSellPrice: cm.averageSellPrice ?? null,
        trendPrice: cm.trendPrice ?? null,
        lowPrice: cm.lowPrice ?? null,
        avg7: cm.avg7 ?? null,
        avg30: cm.avg30 ?? null,
        reverseHoloTrend: cm.reverseHoloTrend ?? null,
      }
    : null;

  return {
    tcgPlayerUrl: tp?.url ?? null,
    tcgPlayerUpdatedAt: tp?.updatedAt ?? null,
    tcgPlayerPrices,
    cardMarketUrl: card?.cardmarket?.url ?? null,
    cardMarketUpdatedAt: card?.cardmarket?.updatedAt ?? null,
    cardMarket,
  };
}

export function priceSnapshotToPricesJson(snapshot) {
  return {
    tcgPlayerUrl: snapshot.tcgPlayerUrl,
    tcgPlayerUpdatedAt: snapshot.tcgPlayerUpdatedAt,
    tcgPlayerPrices: snapshot.tcgPlayerPrices,
    cardMarketUrl: snapshot.cardMarketUrl,
    cardMarketUpdatedAt: snapshot.cardMarketUpdatedAt,
    cardMarket: snapshot.cardMarket,
  };
}

export function snapshotHasTcgMarketPrices(snapshot) {
  const rows = snapshot?.tcgPlayerPrices;
  if (!Array.isArray(rows) || !rows.length) return false;
  return rows.some((r) => r?.market != null || r?.mid != null || r?.low != null);
}

export function pricesJsonForPokemonCatalogCard(staticCard, apiCard) {
  if (apiCard) {
    const snap = priceSnapshotFromPokemonApiCard(apiCard);
    if (snapshotHasTcgMarketPrices(snap)) {
      return priceSnapshotToPricesJson(snap);
    }
  }
  const url = apiCard?.tcgplayer?.url ?? staticCard?.tcgplayer?.url ?? null;
  return url ? { tcgPlayerUrl: url } : {};
}
