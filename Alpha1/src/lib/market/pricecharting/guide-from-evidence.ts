import { priceChartingUsdFromEvidence } from "@/lib/market/catalog-raw-fmv";
import type { MarketEvidence } from "@/lib/scan/schemas";

function pcRows(evidence: MarketEvidence[]): MarketEvidence[] {
  return evidence.filter((e) => /pricecharting/i.test(e.source ?? ""));
}

function guideUsd(rows: MarketEvidence[], pattern: RegExp): number | null {
  const hit = rows.find(
    (r) =>
      r.kind === "reference" &&
      typeof r.priceUsd === "number" &&
      Number.isFinite(r.priceUsd) &&
      pattern.test(r.title),
  );
  return hit?.priceUsd != null ? Math.round(hit.priceUsd) : null;
}

/** Map PriceCharting reference evidence → cached `prices_json` guide fields. */
export function priceChartingGuideFieldsFromEvidence(evidence: MarketEvidence[]): {
  looseUsd: number | null;
  psa10Usd: number | null;
  psa9Usd: number | null;
  psa8Usd: number | null;
  productUrl: string | null;
} {
  const rows = pcRows(evidence);
  const looseUsd = priceChartingUsdFromEvidence(rows) ?? guideUsd(rows, /loose|ungraded/i);
  const psa10Usd = guideUsd(rows, /psa\s*10|graded/i);
  const psa9Usd = guideUsd(rows, /psa\s*9|cib|complete guide/i);
  const psa8Usd = guideUsd(rows, /psa\s*8|new guide/i);
  const urlRow = rows.find((r) => r.url?.includes("pricecharting.com"));
  return {
    looseUsd,
    psa10Usd,
    psa9Usd,
    psa8Usd,
    productUrl: urlRow?.url ?? null,
  };
}
