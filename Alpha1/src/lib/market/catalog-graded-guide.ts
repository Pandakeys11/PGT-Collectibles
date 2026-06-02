import type { CatalogPriceSnapshot } from "@/lib/market/pokemon-catalog";
import { parseCatalogPriceSnapshot } from "@/lib/market/catalog-reference-evidence";
import { resolveEvidenceGradeBucket } from "@/lib/market/catalog-raw-fmv";
import type { CatalogMarketIntel } from "@/lib/pgt-registry/pgt-market-intel-persist";
import { median } from "@/lib/market/fair-value";
import type { GradeBucket } from "@/lib/market/market-intelligence";
import type { MarketEvidence } from "@/lib/scan/schemas";

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

function intelRowToEvidence(row: CatalogMarketIntel["comps"][number]): MarketEvidence {
  return {
    kind: row.kind as MarketEvidence["kind"],
    title: row.title,
    priceUsd: row.priceUsd,
    observedAt: row.observedAt,
    url: row.url,
    source: row.source,
    slab: row.slab,
    gradeBucket: (row.gradeBucket as MarketEvidence["gradeBucket"] | null) ?? undefined,
  };
}

function compMedian(
  intel: CatalogMarketIntel | null | undefined,
  gradeBucket: GradeBucket,
): number | null {
  if (!intel?.comps.length) return null;
  const matches = (row: CatalogMarketIntel["comps"][number]) =>
    resolveEvidenceGradeBucket(intelRowToEvidence(row)) === gradeBucket;
  const prices = intel.comps
    .filter(
      (row) =>
        matches(row) &&
        row.priceUsd != null &&
        Number.isFinite(row.priceUsd) &&
        (row.kind === "sold" || row.kind === "active" || row.kind === "reference"),
    )
    .map((row) => row.priceUsd as number);
  const sold = intel.comps
    .filter((row) => matches(row) && row.kind === "sold")
    .map((row) => row.priceUsd)
    .filter((n): n is number => n != null && Number.isFinite(n));
  return median(sold) ?? median(prices);
}

function parsePricesInput(
  pricesInput: CatalogPriceSnapshot | Record<string, unknown> | null | undefined,
): CatalogPriceSnapshot {
  if (pricesInput && "tcgPlayerPrices" in pricesInput) {
    return pricesInput as CatalogPriceSnapshot;
  }
  return parseCatalogPriceSnapshot(
    pricesInput && typeof pricesInput === "object"
      ? (pricesInput as Record<string, unknown>)
      : null,
  );
}

/** Cached PriceCharting PSA 8 / 9 / 10 guide prices from catalog `prices_json`. */
export function resolvePriceChartingGradedTiers(
  pricesInput: CatalogPriceSnapshot | Record<string, unknown> | null | undefined,
): CatalogGradedGuideTier[] {
  const prices = parsePricesInput(pricesInput);
  const p =
    pricesInput && typeof pricesInput === "object" ? (pricesInput as Record<string, unknown>) : {};
  const psa8Guide =
    prices.priceChartingPsa8Usd ??
    (typeof p.priceChartingPsa8Usd === "number" ? p.priceChartingPsa8Usd : null);
  const psa9Guide =
    prices.priceChartingPsa9Usd ??
    (typeof p.priceChartingPsa9Usd === "number" ? p.priceChartingPsa9Usd : null);
  const psa10Guide = prices.priceChartingPsa10Usd ?? null;

  return [
    { label: "PSA 10", usd: psa10Guide, source: "PriceCharting" },
    { label: "PSA 9", usd: psa9Guide, source: "PriceCharting" },
    { label: "PSA 8", usd: psa8Guide, source: "PriceCharting" },
  ].filter((t) => t.usd != null) as CatalogGradedGuideTier[];
}

/**
 * PSA 8/9/10 guide bands: PGT comps first, then PriceCharting cache on `prices_json`.
 * PriceCharting maps: `new-price` ≈ grade 8, `cib-price` ≈ grade 9, `psa-10` / graded ≈ 10.
 */
export function resolveCatalogGradedGuide(
  pricesInput: CatalogPriceSnapshot | Record<string, unknown> | null | undefined,
  intel?: CatalogMarketIntel | null,
): CatalogGradedGuide {
  const prices = parsePricesInput(pricesInput);
  const pcTiers = resolvePriceChartingGradedTiers(pricesInput);
  const pc10 = pcTiers.find((t) => t.label === "PSA 10")?.usd ?? prices.priceChartingPsa10Usd ?? null;
  const pc9 = pcTiers.find((t) => t.label === "PSA 9")?.usd ?? prices.priceChartingPsa9Usd ?? null;
  const pc8 = pcTiers.find((t) => t.label === "PSA 8")?.usd ?? prices.priceChartingPsa8Usd ?? null;

  const comp10 = compMedian(intel, "psa10");
  const comp9 = compMedian(intel, "psa9");

  const tiers: CatalogGradedGuideTier[] = [
    {
      label: "PSA 10",
      usd: comp10 ?? pc10,
      source: comp10 != null ? "PGT comps" : "PriceCharting",
    },
    {
      label: "PSA 9",
      usd: comp9 ?? pc9,
      source: comp9 != null ? "PGT comps" : "PriceCharting",
    },
    {
      label: "PSA 8",
      usd: pc8,
      source: "PriceCharting",
    },
  ].filter((t) => t.usd != null) as CatalogGradedGuideTier[];

  const headline = tiers.find((t) => t.label === "PSA 10") ?? tiers[0] ?? null;

  return { tiers, headline };
}
