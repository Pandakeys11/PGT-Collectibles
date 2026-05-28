import type { CatalogPriceSnapshot } from "@/lib/market/pokemon-catalog";
import { parseCatalogPriceSnapshot } from "@/lib/market/catalog-reference-evidence";
import type { CatalogMarketIntel } from "@/lib/pgt-registry/pgt-market-intel-persist";
import { median } from "@/lib/market/fair-value";

export type CatalogGradedGuideTier = {
  label: "PSA 8" | "PSA 9" | "PSA 10";
  usd: number | null;
  source: string;
};

export type CatalogGradedGuide = {
  tiers: CatalogGradedGuideTier[];
  /** Best headline graded tier for compact UI. */
  headline: CatalogGradedGuideTier | null;
};

function compMedian(
  intel: CatalogMarketIntel | null | undefined,
  gradeBucket: string,
): number | null {
  if (!intel?.comps.length) return null;
  const prices = intel.comps
    .filter(
      (row) =>
        (row.gradeBucket ?? "raw") === gradeBucket &&
        row.priceUsd != null &&
        Number.isFinite(row.priceUsd) &&
        (row.kind === "sold" || row.kind === "active" || row.kind === "reference"),
    )
    .map((row) => row.priceUsd as number);
  const sold = intel.comps
    .filter((row) => (row.gradeBucket ?? "raw") === gradeBucket && row.kind === "sold")
    .map((row) => row.priceUsd)
    .filter((n): n is number => n != null && Number.isFinite(n));
  return median(sold) ?? median(prices);
}

/**
 * PSA 8/9/10 guide bands: PGT comps first, then PriceCharting cache on `prices_json`.
 * PriceCharting maps: `new-price` ≈ grade 8, `cib-price` ≈ grade 9, `psa-10` / graded ≈ 10.
 */
export function resolveCatalogGradedGuide(
  pricesInput: CatalogPriceSnapshot | Record<string, unknown> | null | undefined,
  intel?: CatalogMarketIntel | null,
): CatalogGradedGuide {
  const prices =
    pricesInput && "tcgPlayerPrices" in pricesInput
      ? (pricesInput as CatalogPriceSnapshot)
      : parseCatalogPriceSnapshot(
          pricesInput && typeof pricesInput === "object"
            ? (pricesInput as Record<string, unknown>)
            : null,
        );

  const p = pricesInput && typeof pricesInput === "object" ? (pricesInput as Record<string, unknown>) : {};
  const psa8Guide =
    prices.priceChartingPsa8Usd ??
    (typeof p.priceChartingPsa8Usd === "number" ? p.priceChartingPsa8Usd : null);
  const psa9Guide =
    prices.priceChartingPsa9Usd ??
    (typeof p.priceChartingPsa9Usd === "number" ? p.priceChartingPsa9Usd : null);

  const tiers: CatalogGradedGuideTier[] = [
    {
      label: "PSA 10",
      usd: compMedian(intel, "psa10") ?? prices.priceChartingPsa10Usd ?? null,
      source: compMedian(intel, "psa10") != null ? "PGT comps" : "PriceCharting",
    },
    {
      label: "PSA 9",
      usd: compMedian(intel, "psa9") ?? psa9Guide ?? null,
      source: compMedian(intel, "psa9") != null ? "PGT comps" : "PriceCharting",
    },
    {
      label: "PSA 8",
      usd: compMedian(intel, "psa8") ?? psa8Guide ?? null,
      source: compMedian(intel, "psa8") != null ? "PGT comps" : "PriceCharting",
    },
  ].filter((t) => t.usd != null) as CatalogGradedGuideTier[];

  const headline = tiers.find((t) => t.label === "PSA 10") ?? tiers[0] ?? null;

  return { tiers, headline };
}
