import type { MarketEvidence } from "@/lib/scan/schemas";
import { median } from "@/lib/scan/market-intelligence";

export function evidenceRowKey(item: MarketEvidence): string {
  return `${item.kind}|${item.source ?? ""}|${item.title}|${item.observedAt ?? ""}|${item.priceUsd ?? ""}`;
}

function stdDev(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/** Rows more than ±2.5σ from the priced median. */
export function outlierEvidenceKeys(
  items: MarketEvidence[],
  sigma = 2.5,
): Set<string> {
  const priced = items
    .map((item) => ({ item, price: item.priceUsd }))
    .filter((row): row is { item: MarketEvidence; price: number } =>
      row.price != null && Number.isFinite(row.price),
    );
  const prices = priced.map((row) => row.price);
  const med = median(prices);
  const sd = stdDev(prices);
  const keys = new Set<string>();
  if (med == null || sd == null || sd === 0) return keys;
  for (const row of priced) {
    const z = Math.abs(row.price - med) / sd;
    if (z > sigma) keys.add(evidenceRowKey(row.item));
  }
  return keys;
}

export function computeFilteredFmv(
  items: MarketEvidence[],
  excludedKeys: Set<string>,
): { fmv: number | null; soldCount: number; basis: string } {
  const soldPrices = items
    .filter((item) => item.kind === "sold" && !excludedKeys.has(evidenceRowKey(item)))
    .map((item) => item.priceUsd)
    .filter((value): value is number => value != null && Number.isFinite(value));
  const fmv = median(soldPrices);
  return {
    fmv: fmv != null ? Math.round(fmv * 100) / 100 : null,
    soldCount: soldPrices.length,
    basis:
      soldPrices.length >= 2
        ? "median_sold_comps"
        : soldPrices.length === 1
          ? "single_sold_comp"
          : "insufficient_sold_comps",
  };
}
