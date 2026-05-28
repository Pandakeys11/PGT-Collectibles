import type { CatalogMarketIntel } from "@/lib/pgt-registry/pgt-market-intel-persist";
import { median } from "@/lib/market/fair-value";

function compPrices(
  comps: CatalogMarketIntel["comps"],
  options: { gradeBucket?: string; kinds?: string[] },
): number[] {
  const kinds = options.kinds ?? ["sold", "active"];
  return comps
    .filter((row) => {
      if (row.priceUsd == null || !Number.isFinite(row.priceUsd)) return false;
      if (!kinds.includes(row.kind)) return false;
      if (options.gradeBucket) {
        return (row.gradeBucket ?? "raw") === options.gradeBucket;
      }
      return true;
    })
    .map((row) => row.priceUsd as number);
}

/** PGT comp median for raw / PSA 10 buckets (sold preferred, then active). */
export function tickerFmvFromIntel(intel: CatalogMarketIntel | null): {
  rawFmvUsd: number | null;
  psa10FmvUsd: number | null;
} {
  if (!intel?.comps.length) {
    return { rawFmvUsd: null, psa10FmvUsd: null };
  }

  const rawSold = compPrices(intel.comps, { gradeBucket: "raw", kinds: ["sold"] });
  const rawActive = compPrices(intel.comps, { gradeBucket: "raw", kinds: ["active"] });
  const rawFmvUsd = median(rawSold) ?? median(rawActive) ?? median(compPrices(intel.comps, { kinds: ["sold"] }));

  const psa10Sold = compPrices(intel.comps, { gradeBucket: "psa10", kinds: ["sold"] });
  const psa10Active = compPrices(intel.comps, { gradeBucket: "psa10", kinds: ["active"] });
  const psa10FmvUsd = median(psa10Sold) ?? median(psa10Active);

  return {
    rawFmvUsd: rawFmvUsd != null ? Math.round(rawFmvUsd * 100) / 100 : null,
    psa10FmvUsd: psa10FmvUsd != null ? Math.round(psa10FmvUsd * 100) / 100 : null,
  };
}
