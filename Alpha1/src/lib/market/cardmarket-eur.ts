/**
 * Pokémon TCG API embeds Cardmarket prices in EUR.
 * We convert to USD for display/comparison with TCGPlayer and eBay (USD).
 */

const DEFAULT_EUR_USD = 1.08;

function readRateFromEnv(): number | null {
  if (typeof process === "undefined") return null;
  const raw = process.env.CARDMARKET_EUR_USD_RATE?.trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0.5 || n > 2) return null;
  return n;
}

/** EUR→USD rate for Cardmarket display (env override on server). */
export function getCardmarketEurUsdRate(): number {
  return readRateFromEnv() ?? DEFAULT_EUR_USD;
}

export function eurToUsd(eur: number): number {
  if (!Number.isFinite(eur)) return eur;
  return Math.round(eur * getCardmarketEurUsdRate() * 100) / 100;
}

export type CardMarketPriceFields = {
  averageSellPrice?: number | null;
  trendPrice?: number | null;
  lowPrice?: number | null;
  avg7?: number | null;
  avg30?: number | null;
  reverseHoloTrend?: number | null;
};

/** Cardmarket EU momentum: 7d avg vs 30d avg (%). Matches US PokeTrace window semantics. */
export function cardmarketMomentumPct7dVs30d(
  cm: CardMarketPriceFields | null | undefined,
): number | null {
  if (!cm?.avg7 || !cm.avg30 || cm.avg30 <= 0) return null;
  return Math.round(((cm.avg7 - cm.avg30) / cm.avg30) * 1000) / 10;
}

/** @deprecated Use cardmarketMomentumPct7dVs30d — trend vs avg7 was a different metric. */
export function cardmarketMomentumPct(cm: CardMarketPriceFields | null | undefined): number | null {
  return cardmarketMomentumPct7dVs30d(cm);
}

export function cardmarketDeltaEur7dVs30d(
  cm: CardMarketPriceFields | null | undefined,
): number | null {
  if (cm?.avg7 == null || cm.avg30 == null) return null;
  return Math.round((cm.avg7 - cm.avg30) * 100) / 100;
}

/** @deprecated Use cardmarketDeltaEur7dVs30d */
export function cardmarketDeltaEur(cm: CardMarketPriceFields | null | undefined): number | null {
  return cardmarketDeltaEur7dVs30d(cm);
}

export function cardMarketUsdFromSnapshot(
  cm: CardMarketPriceFields | null | undefined,
): number | null {
  if (!cm) return null;
  for (const n of [cm.trendPrice, cm.averageSellPrice, cm.avg30, cm.avg7, cm.lowPrice]) {
    if (typeof n === "number" && Number.isFinite(n) && n >= 0.5) return eurToUsd(n);
  }
  return null;
}
