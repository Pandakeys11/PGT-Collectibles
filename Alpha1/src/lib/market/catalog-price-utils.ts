import type { CatalogPriceSnapshot } from "@/lib/market/pokemon-catalog";
import { parseCatalogPriceSnapshot } from "@/lib/market/catalog-reference-evidence";

export function bestCatalogUsd(prices: CatalogPriceSnapshot): number | null {
  let best: number | null = null;
  for (const row of prices.tcgPlayerPrices) {
    const n = row.market ?? row.mid ?? row.low;
    if (n == null || !Number.isFinite(n)) continue;
    if (best == null || n > best) best = n;
  }
  const cm = prices.cardMarket;
  if (cm) {
    for (const n of [
      cm.trendPrice,
      cm.averageSellPrice,
      cm.avg30,
      cm.avg7,
      cm.lowPrice,
    ]) {
      if (typeof n === "number" && Number.isFinite(n) && (best == null || n > best)) {
        best = n;
      }
    }
  }
  return best;
}

export function hasParseableCatalogPrices(
  pricesJson: Record<string, unknown> | null | undefined,
): boolean {
  const snap = parseCatalogPriceSnapshot(pricesJson);
  if (bestCatalogUsd(snap) != null) return true;
  const cm = snap.cardMarket;
  if (cm?.trendPrice != null && cm.avg7 != null && cm.avg7 > 0) return true;
  return snap.tcgPlayerPrices.length > 0;
}
