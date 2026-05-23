import { formatGraderGradeLabel } from "@/lib/market/market-search-identity";
import { inferCardTargetGradeBucket, inferEvidenceGradeBucket } from "@/lib/market/market-intelligence";
import {
  matchesBgsBlackLabel,
  matchesCgcPristine10,
  matchesPsa10,
  matchesPsa9,
} from "@/lib/market/grade-match";
import { isGradedEvidence, isRawEvidence } from "@/lib/scan/market-intelligence";
import type { ExtractedCard, MarketEvidence } from "@/lib/scan/schemas";

/** Keep sold rows that match the scanned card's lane and target grade. */
export function ebaySoldEvidenceMatchesCard(
  card: ExtractedCard,
  item: MarketEvidence,
): boolean {
  if (item.kind !== "sold") return true;

  const gradeLabel = formatGraderGradeLabel(card.grader, card.grade);
  if (gradeLabel) {
    const h = `${item.slab ?? ""} ${item.title}`.toLowerCase();
    const needle = gradeLabel.toLowerCase();
    if (h.includes(needle)) return true;
    const graderOnly = card.grader?.trim().toLowerCase();
    const num = needle.split(/\s+/).pop();
    if (graderOnly && num && h.includes(graderOnly) && h.includes(num)) return true;
  }

  const target = inferCardTargetGradeBucket(card);

  if (target === "raw") {
    return isRawEvidence(item) || inferEvidenceGradeBucket(item) === "raw";
  }

  if (target === "psa10") return matchesPsa10(item);
  if (target === "psa9") return matchesPsa9(item);
  if (target === "bgsBlackLabel") return matchesBgsBlackLabel(item);
  if (target === "cgcPristine10" || target === "cgc10") return matchesCgcPristine10(item);

  if (target === "bgs10") {
    const h = `${item.slab ?? ""} ${item.title}`.toLowerCase();
    return /bgs|beckett/i.test(h) && /\b10\b/.test(h) && !/black\s*label/i.test(h);
  }

  if (target === "gradedOther") {
    return isGradedEvidence(item);
  }

  return true;
}

export function filterEbaySoldForCard(
  card: ExtractedCard,
  items: MarketEvidence[],
): MarketEvidence[] {
  const sold = items.filter((i) => i.kind === "sold" && i.source?.toLowerCase().includes("ebay"));
  if (sold.length === 0) return items;

  const matched = sold.filter((i) => ebaySoldEvidenceMatchesCard(card, i));
  if (matched.length >= 2) {
    const other = items.filter((i) => !sold.includes(i));
    return [...matched, ...other];
  }
  return items;
}
