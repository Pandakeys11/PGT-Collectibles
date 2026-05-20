import type { MarketEvidence } from "@/lib/scan/schemas";

export type GradeBucketId = "psa10" | "psa9" | "bgsBlackLabel" | "cgcPristine10";

export function evidenceHaystack(item: MarketEvidence): string {
  return `${item.slab ?? ""} ${item.title}`.toLowerCase();
}

/**
 * CGC 10 (Gem Mint, Pristine 10, etc.) — excludes PSA / BGS Black Label primary slabs.
 * Bucket id remains `cgcPristine10` for snapshot compatibility.
 */
export function matchesCgcPristine10(item: MarketEvidence): boolean {
  const h = evidenceHaystack(item);
  if (/psa\s*10|black\s*label|bgs\s*10\s*black|bgs\s*black/i.test(h) && !/cgc/i.test(h)) return false;
  if (/psa\s*9\b/.test(h) && !/cgc/i.test(h)) return false;

  if (item.slab === "CGC 10" || item.slab === "CGC Pristine 10") {
    if (/psa\s*10/i.test(h) && !/cgc/i.test(h)) return false;
    return /cgc/i.test(h) || /pristine|gem\s*mint/i.test(h);
  }

  if (!/cgc/i.test(h)) return false;
  if (!/cgc\s*10(\.0)?\b/i.test(h)) return false;
  if (/cgc\s*9\.?5\b/.test(h) && !/cgc\s*10/i.test(h)) return false;
  return true;
}

export function matchesPsa10(item: MarketEvidence): boolean {
  const h = evidenceHaystack(item);
  if (/black\s*label|bgs\s*black/i.test(h)) return false;
  if (matchesCgcPristine10(item)) return false;
  if (item.slab === "PSA 10") {
    if (/cgc|black\s*label|bgs\s*black/i.test(h) && !/psa/i.test(h)) return false;
    return true;
  }
  return /psa\s*10\b|psa\s*gem\s*10|gem\s*mint\s*10/i.test(h) && !/cgc\s*10\s*prist|black\s*label/i.test(h);
}

export function matchesPsa9(item: MarketEvidence): boolean {
  const h = evidenceHaystack(item);
  if (matchesPsa10(item) || matchesCgcPristine10(item)) return false;
  if (item.slab === "PSA 9") return true;
  return /psa\s*9\b/.test(h);
}

export function matchesBgsBlackLabel(item: MarketEvidence): boolean {
  const h = evidenceHaystack(item);
  if (matchesCgcPristine10(item) || matchesPsa10(item)) return false;
  if (item.slab === "BGS Black Label") return /black\s*label|bgs/i.test(h);
  return /black\s*label|bgs\s*10\s*black|bgs\s*black\s*label/i.test(h);
}

export const GRADE_MATCHERS: Record<GradeBucketId, (item: MarketEvidence) => boolean> = {
  psa10: matchesPsa10,
  psa9: matchesPsa9,
  bgsBlackLabel: matchesBgsBlackLabel,
  cgcPristine10: matchesCgcPristine10,
};

export function filterEvidenceForGrade(
  items: MarketEvidence[],
  bucket: GradeBucketId,
  slabLabel: string,
): MarketEvidence[] {
  const match = GRADE_MATCHERS[bucket];
  return items
    .filter((item) => match(item))
    .map((item) => ({ ...item, slab: slabLabel }));
}
