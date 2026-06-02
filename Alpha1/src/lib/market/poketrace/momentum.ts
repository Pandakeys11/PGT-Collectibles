import {
  resolveCatalogMomentum,
  resolvedCatalogMomentumPct as resolvePct,
} from "@/lib/market/catalog-momentum";
import { parseCatalogPriceSnapshot } from "@/lib/market/catalog-reference-evidence";
import type { CatalogPriceSnapshot } from "@/lib/market/pokemon-catalog";

export { resolveCatalogMomentum, resolvedCatalogMomentumPct } from "@/lib/market/catalog-momentum";

/** @deprecated Import from `@/lib/market/catalog-momentum` */
export function resolvedCatalogMomentumFromJson(
  pricesJson: Record<string, unknown> | null | undefined,
): number | null {
  return resolvePct(parseCatalogPriceSnapshot(pricesJson));
}

export function resolvedCatalogMomentumFromSnapshot(
  prices: CatalogPriceSnapshot,
): number | null {
  return resolveCatalogMomentum(prices).pct;
}
