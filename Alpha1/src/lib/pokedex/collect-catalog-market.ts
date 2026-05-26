import { withTimeout } from "@/lib/async-timeout";
import { collectApiMarketEvidence } from "@/lib/market/adapters/run-api-evidence";
import { collectGradedLanes } from "@/lib/market/collect-premium-grade-lanes";
import {
  filterEvidenceForGrade,
  matchesCgcPristine10,
  matchesPsa10,
} from "@/lib/market/grade-match";
import { collectSnippetMarketEvidence } from "@/lib/market/research";
import { sanitizeEvidenceList } from "@/lib/market/evidence-dates";
import { filterEvidenceByPrintEdition } from "@/lib/scan/print-edition";
import type { TcgCardDetail } from "@/lib/pokedex/tcg-api-types";
import { tcgDetailToExtracted } from "@/lib/pokedex/catalog-market-snapshot";
import type { ExtractedCard, MarketEvidence } from "@/lib/scan/schemas";
import { ebayBrowseAdapter } from "@/lib/market/adapters/ebay";
import { ebaySoldScrapeAdapter } from "@/lib/market/adapters/ebay-sold-scrape";

async function collectEbayBrowse(card: ExtractedCard): Promise<MarketEvidence[]> {
  const result = await withTimeout(ebayBrowseAdapter.collect(card), 12_000, "ebay browse").catch(
    () => ({ evidence: [] as MarketEvidence[] }),
  );
  return result.evidence;
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

export async function collectCatalogMarketEvidence(
  card: TcgCardDetail,
  options?: { printStamps?: string | null },
): Promise<MarketEvidence[]> {
  const extracted = tcgDetailToExtracted(card, options);
  const cgcCard: ExtractedCard = { ...extracted, grader: "CGC", grade: "10 Pristine" };

  const rawSoldResult = await withTimeout(ebaySoldScrapeAdapter.collect(extracted), 28_000, "ebay sold").catch(
    () => ({ evidence: [] as MarketEvidence[] }),
  );
  const rawSold = rawSoldResult.evidence;

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
    ...filterEvidenceForGrade(webSnippets, "cgcPristine10", "CGC Pristine 10"),
    ...filterEvidenceForGrade(cgcSnippets, "cgcPristine10", "CGC Pristine 10"),
  ];

  const rawPool = [...apiEvidence, ...rawSold, ...rawBrowse, ...webSnippets].filter(
    (item) => !matchesPsa10(item) && !matchesCgcPristine10(item),
  );

  const merged = sanitizeEvidenceList(
    dedupeEvidence([...rawPool, ...gradedLanes, ...gradedFromWeb]),
  );
  return filterEvidenceByPrintEdition(merged, extracted);
}
