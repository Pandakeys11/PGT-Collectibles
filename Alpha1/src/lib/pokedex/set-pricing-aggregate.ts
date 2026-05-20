import type { TcgCardSummary } from "@/lib/pokedex/tcg-api-types";

/** Best single-number TCGPlayer reference for a catalog row (max market, else max mid). */
export function bestTcgPlayerReferenceUsd(card: Pick<TcgCardSummary, "tcgplayer">): number | null {
  const prices = card.tcgplayer?.prices;
  if (!prices) return null;
  const markets = Object.values(prices)
    .map((p) => p?.market)
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  if (markets.length > 0) return Math.max(...markets);
  const mids = Object.values(prices)
    .map((p) => p?.mid)
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  return mids.length ? Math.max(...mids) : null;
}

function cardmarketTrendEur(card: Pick<TcgCardSummary, "cardmarket">): number | null {
  const t = card.cardmarket?.prices?.trendPrice;
  if (typeof t === "number" && Number.isFinite(t)) return t;
  const a = card.cardmarket?.prices?.avg30;
  if (typeof a === "number" && Number.isFinite(a)) return a;
  return null;
}

export type CatalogSetPricingRollup = {
  cardCount: number;
  tcgPlayerSumUsd: number;
  tcgPlayerPricedSlots: number;
  cardmarketSumEur: number;
  cardmarketPricedSlots: number;
};

export function rollupCatalogSetPricing(cards: TcgCardSummary[]): CatalogSetPricingRollup {
  let tcgPlayerSumUsd = 0;
  let tcgPlayerPricedSlots = 0;
  let cardmarketSumEur = 0;
  let cardmarketPricedSlots = 0;

  for (const c of cards) {
    const usd = bestTcgPlayerReferenceUsd(c);
    if (usd != null) {
      tcgPlayerSumUsd += usd;
      tcgPlayerPricedSlots += 1;
    }
    const eur = cardmarketTrendEur(c);
    if (eur != null) {
      cardmarketSumEur += eur;
      cardmarketPricedSlots += 1;
    }
  }

  return {
    cardCount: cards.length,
    tcgPlayerSumUsd,
    tcgPlayerPricedSlots,
    cardmarketSumEur,
    cardmarketPricedSlots,
  };
}
