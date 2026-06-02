import { cardMarketUsdFromSnapshot } from "@/lib/market/cardmarket-eur";
import type { CatalogPriceSnapshot } from "@/lib/market/pokemon-catalog";
import { parseCatalogPriceSnapshot } from "@/lib/market/catalog-reference-evidence";

function bestTcgUsd(prices: CatalogPriceSnapshot): number | null {
  let best: number | null = null;
  for (const row of prices.tcgPlayerPrices) {
    const n = row.market ?? row.mid ?? row.low;
    if (n == null || !Number.isFinite(n)) continue;
    if (best == null || n > best) best = n;
  }
  return best;
}

/** Headline USD for movers / chips — TCGPlayer first, else Cardmarket (EUR converted). */
export function moverDisplayUsd(prices: CatalogPriceSnapshot): number | null {
  const tcg = bestTcgUsd(prices);
  if (tcg != null) return Math.round(tcg);
  const cm = cardMarketUsdFromSnapshot(prices.cardMarket);
  return cm != null ? Math.round(cm) : null;
}

/** Max reference across sources (legacy rollups). Never mixes raw EUR with USD. */
export function bestCatalogUsd(prices: CatalogPriceSnapshot): number | null {
  return moverDisplayUsd(prices);
}

export function hasParseableCatalogPrices(
  pricesJson: Record<string, unknown> | null | undefined,
): boolean {
  const snap = parseCatalogPriceSnapshot(pricesJson);
  if (moverDisplayUsd(snap) != null) return true;
  const cm = snap.cardMarket;
  if (cm?.avg7 != null && cm.avg30 != null && cm.avg30 > 0) return true;
  if (snap.pokeTrace?.momentumPct != null) return true;
  return snap.tcgPlayerPrices.length > 0;
}
