import type { CatalogCardSummary } from "@/lib/catalog/catalog-types";
import type { CatalogPriceSnapshot } from "@/lib/market/pokemon-catalog";
import { parseCatalogPriceSnapshot } from "@/lib/market/catalog-reference-evidence";
import type { TcgCardSummary } from "@/lib/pokedex/tcg-api-types";

/** Cards from master catalog DB or live TCG API — both feed set insight rollups. */
export type SetInsightCardSource = CatalogCardSummary | TcgCardSummary;

function priceSnapshotFromTcgCard(card: TcgCardSummary): CatalogPriceSnapshot {
  const tcgPlayerPrices = card.tcgplayer?.prices
    ? Object.entries(card.tcgplayer.prices).map(([variant, p]) => ({
        variant,
        low: p?.low ?? null,
        mid: p?.mid ?? null,
        high: p?.high ?? null,
        market: p?.market ?? null,
        directLow: p?.directLow ?? null,
      }))
    : [];
  const cm = card.cardmarket?.prices;
  return {
    tcgPlayerUrl: card.tcgplayer?.url ?? null,
    tcgPlayerUpdatedAt: card.tcgplayer?.updatedAt ?? null,
    tcgPlayerPrices,
    cardMarketUrl: card.cardmarket?.url ?? null,
    cardMarketUpdatedAt: card.cardmarket?.updatedAt ?? null,
    cardMarket: cm
      ? {
          averageSellPrice: cm.averageSellPrice ?? null,
          trendPrice: cm.trendPrice ?? null,
          lowPrice: cm.lowPrice ?? null,
          avg7: cm.avg7 ?? null,
          avg30: cm.avg30 ?? null,
          reverseHoloTrend: cm.reverseHoloTrend ?? null,
        }
      : null,
  };
}

function isTcgInsightCard(card: SetInsightCardSource): card is TcgCardSummary {
  return "tcgplayer" in card || "cardmarket" in card;
}

function pricesForInsightCard(card: SetInsightCardSource): CatalogPriceSnapshot {
  if ("prices" in card && card.prices) return card.prices;
  if (isTcgInsightCard(card)) return priceSnapshotFromTcgCard(card);
  return parseCatalogPriceSnapshot(null);
}

export type SetInsightCardRow = {
  catalogId: string;
  name: string;
  number: string | null;
  rarity: string | null;
  imageUrl: string | null;
  priceUsd: number | null;
  momentumPct: number | null;
};

export type SetInsightRollup = {
  cardCount: number;
  tcgPlayerSumUsd: number;
  pricedSlots: number;
};

function bestTcgUsd(prices: CatalogPriceSnapshot): number | null {
  let best: number | null = null;
  for (const row of prices.tcgPlayerPrices) {
    const n = row.market ?? row.mid ?? row.low;
    if (n == null || !Number.isFinite(n)) continue;
    if (best == null || n > best) best = n;
  }
  return best;
}

/** Cardmarket trend vs 7-day avg — catalog proxy for short-term momentum (not live 24h feed). */
export function catalogMomentumPct(prices: CatalogPriceSnapshot): number | null {
  const cm = prices.cardMarket;
  if (!cm?.trendPrice || !cm.avg7 || cm.avg7 <= 0) return null;
  return Math.round(((cm.trendPrice - cm.avg7) / cm.avg7) * 1000) / 10;
}

export function cardInsightRow(card: SetInsightCardSource): SetInsightCardRow {
  const prices = pricesForInsightCard(card);
  const number = card.number ?? null;
  const rarity = card.rarity ?? null;
  return {
    catalogId: card.id,
    name: card.name,
    number,
    rarity,
    imageUrl: card.images?.small ?? card.images?.large ?? null,
    priceUsd: bestTcgUsd(prices),
    momentumPct: catalogMomentumPct(prices),
  };
}

export function rollupSetInsightCards(cards: SetInsightCardSource[]): SetInsightRollup {
  let tcgPlayerSumUsd = 0;
  let pricedSlots = 0;
  for (const card of cards) {
    const prices = pricesForInsightCard(card);
    const usd = bestTcgUsd(prices);
    if (usd != null) {
      tcgPlayerSumUsd += usd;
      pricedSlots += 1;
    }
  }
  return {
    cardCount: cards.length,
    tcgPlayerSumUsd: Math.round(tcgPlayerSumUsd * 100) / 100,
    pricedSlots,
  };
}

export function isPromoLikeCard(card: SetInsightCardSource): boolean {
  const r = (card.rarity ?? "").toLowerCase();
  const n = card.name.toLowerCase();
  return (
    r.includes("promo") ||
    n.includes("promo") ||
    r.includes("black star") ||
    r.includes("prize")
  );
}

export function topValueCards(cards: SetInsightCardSource[], limit = 5): SetInsightCardRow[] {
  return cards
    .map(cardInsightRow)
    .filter((r) => r.priceUsd != null)
    .sort((a, b) => (b.priceUsd ?? 0) - (a.priceUsd ?? 0))
    .slice(0, limit);
}

export function topMomentumCards(cards: SetInsightCardSource[], limit = 4): SetInsightCardRow[] {
  return cards
    .map(cardInsightRow)
    .filter((r) => r.momentumPct != null && Math.abs(r.momentumPct!) >= 3)
    .sort((a, b) => Math.abs(b.momentumPct ?? 0) - Math.abs(a.momentumPct ?? 0))
    .slice(0, limit);
}

export function promoCardsInSet(cards: SetInsightCardSource[], limit = 5): SetInsightCardRow[] {
  return cards
    .filter(isPromoLikeCard)
    .map(cardInsightRow)
    .sort((a, b) => (b.priceUsd ?? 0) - (a.priceUsd ?? 0))
    .slice(0, limit);
}
