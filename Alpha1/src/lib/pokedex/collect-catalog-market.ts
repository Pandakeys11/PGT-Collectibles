import { withTimeout } from "@/lib/async-timeout";
import { collectApiMarketEvidence } from "@/lib/market/adapters/run-api-evidence";
import { ebayBrowseAdapter } from "@/lib/market/adapters/ebay";
import { ebaySoldScrapeAdapter } from "@/lib/market/adapters/ebay-sold-scrape";
import {
  filterEvidenceForGrade,
  matchesCgcPristine10,
  matchesPsa10,
  type GradeBucketId,
} from "@/lib/market/grade-match";
import { collectSnippetMarketEvidence } from "@/lib/market/research";
import { sanitizeEvidenceList } from "@/lib/market/evidence-dates";
import type { TcgCardDetail } from "@/lib/pokedex/tcg-api-types";
import { tcgDetailToExtracted } from "@/lib/pokedex/catalog-market-snapshot";
import type { ExtractedCard, MarketEvidence } from "@/lib/scan/schemas";

const GRADED_QUERIES: Array<{ grader: string; grade: string; slab: string; bucket: GradeBucketId }> = [
  { grader: "PSA", grade: "10", slab: "PSA 10", bucket: "psa10" },
  { grader: "PSA", grade: "9", slab: "PSA 9", bucket: "psa9" },
  { grader: "BGS", grade: "10 Black Label", slab: "BGS Black Label", bucket: "bgsBlackLabel" },
  { grader: "CGC", grade: "10", slab: "CGC 10", bucket: "cgcPristine10" },
];

const GRADED_LANE_MIN_ROWS = 2;

function gradedEvidenceFromRawSold(rawSold: MarketEvidence[]): MarketEvidence[] {
  return GRADED_QUERIES.flatMap(({ bucket, slab }) => filterEvidenceForGrade(rawSold, bucket, slab));
}

function dedupeEvidence(items: MarketEvidence[]): MarketEvidence[] {
  const seen = new Set<string>();
  const out: MarketEvidence[] = [];
  for (const item of items) {
    const key = `${item.kind}|${item.source ?? ""}|${item.title}|${item.priceUsd ?? ""}|${item.url ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

async function collectEbaySold(card: ExtractedCard): Promise<MarketEvidence[]> {
  const result = await withTimeout(ebaySoldScrapeAdapter.collect(card), 28_000, "ebay sold").catch(() => ({
    evidence: [] as MarketEvidence[],
  }));
  return result.evidence;
}

async function collectEbayBrowse(card: ExtractedCard): Promise<MarketEvidence[]> {
  const result = await withTimeout(ebayBrowseAdapter.collect(card), 12_000, "ebay browse").catch(() => ({
    evidence: [] as MarketEvidence[],
  }));
  return result.evidence;
}

async function collectGradedLanes(base: ExtractedCard, rawSold: MarketEvidence[]): Promise<MarketEvidence[]> {
  const counts = new Map<GradeBucketId, number>();
  for (const def of GRADED_QUERIES) {
    counts.set(def.bucket, filterEvidenceForGrade(rawSold, def.bucket, def.slab).length);
  }

  const settled = await Promise.allSettled(
    GRADED_QUERIES.map(async ({ grader, grade, slab, bucket }) => {
      if ((counts.get(bucket) ?? 0) >= GRADED_LANE_MIN_ROWS) return [];
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

  return [...gradedEvidenceFromRawSold(rawSold), ...supplement];
}

export async function collectCatalogMarketEvidence(card: TcgCardDetail): Promise<MarketEvidence[]> {
  const extracted = tcgDetailToExtracted(card);
  const cgcCard: ExtractedCard = { ...extracted, grader: "CGC", grade: "10" };

  const rawSold = await collectEbaySold(extracted);

  const [apiEvidence, rawBrowse, gradedLanes, webSnippets, cgcSnippets] = await Promise.all([
    withTimeout(collectApiMarketEvidence(extracted), 18_000, "catalog market api").catch(() => []),
    collectEbayBrowse(extracted),
    collectGradedLanes(extracted, rawSold),
    withTimeout(collectSnippetMarketEvidence(extracted), 22_000, "catalog web snippets").catch(() => []),
    withTimeout(collectSnippetMarketEvidence(cgcCard), 14_000, "cgc 10 snippets").catch(() => []),
  ]);

  const gradedFromWeb = [
    ...filterEvidenceForGrade(webSnippets, "psa10", "PSA 10"),
    ...filterEvidenceForGrade(webSnippets, "psa9", "PSA 9"),
    ...filterEvidenceForGrade(webSnippets, "bgsBlackLabel", "BGS Black Label"),
    ...filterEvidenceForGrade(webSnippets, "cgcPristine10", "CGC 10"),
    ...filterEvidenceForGrade(cgcSnippets, "cgcPristine10", "CGC 10"),
  ];

  const rawPool = [...apiEvidence, ...rawSold, ...rawBrowse, ...webSnippets].filter(
    (item) => !matchesPsa10(item) && !matchesCgcPristine10(item),
  );

  return sanitizeEvidenceList(dedupeEvidence([...rawPool, ...gradedLanes, ...gradedFromWeb]));
}
