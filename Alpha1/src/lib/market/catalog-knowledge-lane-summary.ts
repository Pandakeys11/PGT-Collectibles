import { formatFmvUsd } from "@/lib/market/fmv-display";
import { resolveEvidenceGradeBucket } from "@/lib/market/catalog-raw-fmv";
import { gradeBucketLabel, type GradeBucket } from "@/lib/market/market-intelligence";
import type { MarketEvidence } from "@/lib/scan/schemas";

const DISPLAY_LANES: GradeBucket[] = [
  "raw",
  "psa9",
  "psa10",
  "bgsBlackLabel",
  "cgcPristine10",
  "tag10",
];

function withPrice(item: MarketEvidence): boolean {
  return typeof item.priceUsd === "number" && Number.isFinite(item.priceUsd) && item.priceUsd > 0;
}

function observedMs(item: MarketEvidence): number {
  if (!item.observedAt) return 0;
  const t = Date.parse(item.observedAt);
  return Number.isNaN(t) ? 0 : t;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
}

function latestOf(
  items: MarketEvidence[],
  kind: MarketEvidence["kind"],
): MarketEvidence | null {
  return (
    [...items]
      .filter((item) => item.kind === kind && withPrice(item))
      .sort((a, b) => observedMs(b) - observedMs(a))[0] ?? null
  );
}

export type CatalogLaneCompSummary = {
  bucket: GradeBucket;
  label: string;
  soldDisplay: string;
  listedDisplay: string;
  soldCount: number;
  activeCount: number;
  hasData: boolean;
};

function summarizeLane(bucket: GradeBucket, items: MarketEvidence[]): CatalogLaneCompSummary {
  const soldPrices = items
    .filter((item) => item.kind === "sold" && withPrice(item))
    .map((item) => item.priceUsd as number);
  const activePrices = items
    .filter((item) => item.kind === "active" && withPrice(item))
    .map((item) => item.priceUsd as number);

  const latestSold = latestOf(items, "sold");
  const latestListed = latestOf(items, "active");
  const soldUsd = latestSold?.priceUsd ?? median(soldPrices);
  const listedUsd = latestListed?.priceUsd ?? median(activePrices);

  const soldCount = items.filter((item) => item.kind === "sold").length;
  const activeCount = items.filter((item) => item.kind === "active").length;

  return {
    bucket,
    label: gradeBucketLabel(bucket),
    soldDisplay: formatFmvUsd(soldUsd),
    listedDisplay: formatFmvUsd(listedUsd),
    soldCount,
    activeCount,
    hasData: soldCount + activeCount > 0 || soldUsd != null || listedUsd != null,
  };
}

/** Grade-aware sold / listed cells for catalog card detail (raw + graded lanes). */
export function buildCatalogLaneCompSummaries(
  evidence: MarketEvidence[],
): CatalogLaneCompSummary[] {
  const byBucket = new Map<GradeBucket, MarketEvidence[]>();
  for (const bucket of DISPLAY_LANES) byBucket.set(bucket, []);
  for (const item of evidence) {
    const bucket = resolveEvidenceGradeBucket(item);
    if (!DISPLAY_LANES.includes(bucket)) continue;
    byBucket.get(bucket)!.push(item);
  }

  return DISPLAY_LANES.map((bucket) =>
    summarizeLane(bucket, byBucket.get(bucket) ?? []),
  ).filter((row) => row.hasData);
}
