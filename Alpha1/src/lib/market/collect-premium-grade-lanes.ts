import { withTimeout } from "@/lib/async-timeout";
import { ebayBrowseAdapter } from "@/lib/market/adapters/ebay";
import { ebaySoldScrapeAdapter } from "@/lib/market/adapters/ebay-sold-scrape";
import {
  filterEvidenceForGrade,
  type GradeBucketId,
} from "@/lib/market/grade-match";
import type { ExtractedCard, MarketEvidence } from "@/lib/scan/schemas";

/** Premium UI buckets + PSA 9 (catalog index). */
export const GRADED_LANE_DEFS: Array<{
  grader: string;
  grade: string;
  slab: string;
  bucket: GradeBucketId;
}> = [
  { grader: "PSA", grade: "10", slab: "PSA 10", bucket: "psa10" },
  { grader: "PSA", grade: "9", slab: "PSA 9", bucket: "psa9" },
  { grader: "BGS", grade: "10 Black Label", slab: "BGS Black Label", bucket: "bgsBlackLabel" },
  { grader: "CGC", grade: "10 Pristine", slab: "CGC Pristine 10", bucket: "cgcPristine10" },
];

/** Shown in Liquid Scan “Premium graded comps” rail. */
export const PREMIUM_GRADE_BUCKETS: GradeBucketId[] = [
  "psa10",
  "bgsBlackLabel",
  "cgcPristine10",
];

const DEFAULT_LANE_MIN_ROWS = 2;

function laneMinRows(): number {
  const n = Number(process.env.MARKET_PREMIUM_LANE_MIN_ROWS ?? DEFAULT_LANE_MIN_ROWS);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : DEFAULT_LANE_MIN_ROWS;
}

function gradedEvidenceFromRawSold(rawSold: MarketEvidence[]): MarketEvidence[] {
  return GRADED_LANE_DEFS.flatMap(({ bucket, slab }) =>
    filterEvidenceForGrade(rawSold, bucket, slab),
  );
}

async function collectEbaySold(card: ExtractedCard): Promise<MarketEvidence[]> {
  const result = await withTimeout(ebaySoldScrapeAdapter.collect(card), 28_000, "ebay sold").catch(
    () => ({ evidence: [] as MarketEvidence[] }),
  );
  return result.evidence;
}

async function collectEbayBrowse(card: ExtractedCard): Promise<MarketEvidence[]> {
  const result = await withTimeout(ebayBrowseAdapter.collect(card), 12_000, "ebay browse").catch(
    () => ({ evidence: [] as MarketEvidence[] }),
  );
  return result.evidence;
}

function countByBucket(rawSold: MarketEvidence[]): Map<GradeBucketId, number> {
  const counts = new Map<GradeBucketId, number>();
  for (const def of GRADED_LANE_DEFS) {
    counts.set(def.bucket, filterEvidenceForGrade(rawSold, def.bucket, def.slab).length);
  }
  return counts;
}

export type CollectGradedLanesOptions = {
  /** Only fetch these buckets (default: all GRADED_LANE_DEFS). */
  buckets?: GradeBucketId[];
  /** Min rows in `rawSold` before skipping a dedicated eBay fetch for that bucket. */
  minRows?: number;
};

/**
 * Tag sold rows from a broad search into grade buckets, then run grade-specific eBay
 * sold/active fetches for lanes that are still thin (PSA 10, BGS BL, CGC Pristine, PSA 9).
 */
export async function collectGradedLanes(
  base: ExtractedCard,
  rawSold: MarketEvidence[],
  options: CollectGradedLanesOptions = {},
): Promise<MarketEvidence[]> {
  const minRows = options.minRows ?? laneMinRows();
  const bucketFilter = options.buckets ? new Set(options.buckets) : null;
  const defs = GRADED_LANE_DEFS.filter((d) => !bucketFilter || bucketFilter.has(d.bucket));

  const counts = countByBucket(rawSold);

  const settled = await Promise.allSettled(
    defs.map(async ({ grader, grade, slab, bucket }) => {
      if ((counts.get(bucket) ?? 0) >= minRows) return [];
      const card: ExtractedCard = { ...base, grader, grade };
      const [soldRows, browseRows] = await Promise.all([
        collectEbaySold(card).then((rows) => filterEvidenceForGrade(rows, bucket, slab)),
        collectEbayBrowse(card).then((rows) => filterEvidenceForGrade(rows, bucket, slab)),
      ]);
      return [...soldRows, ...browseRows];
    }),
  );

  const supplement: MarketEvidence[] = [];
  for (const result of settled) {
    if (result.status === "fulfilled") supplement.push(...result.value);
  }

  const taggedFromRaw = bucketFilter
    ? defs.flatMap(({ bucket, slab }) => filterEvidenceForGrade(rawSold, bucket, slab))
    : gradedEvidenceFromRawSold(rawSold);

  return [...taggedFromRaw, ...supplement];
}

/** Premium-only lane harvest for scan enrich (PSA 10 · BGS BL · CGC Pristine 10). */
export async function collectPremiumGradeLanes(
  base: ExtractedCard,
  rawSold: MarketEvidence[],
): Promise<MarketEvidence[]> {
  return collectGradedLanes(base, rawSold, { buckets: PREMIUM_GRADE_BUCKETS });
}
