import { inferEvidenceGradeBucket } from "@/lib/market/market-intelligence";
import type { MarketEvidence } from "@/lib/scan/schemas";

/** Normalize sold rows with grade bucket + default sale type for FMV ladders. */
export function enrichEbaySoldEvidence(item: MarketEvidence): MarketEvidence {
  const gradeBucket = item.gradeBucket ?? inferEvidenceGradeBucket(item);
  return {
    ...item,
    gradeBucket,
    saleType: item.saleType ?? "auction",
    confidence: item.confidence ?? (item.kind === "sold" ? 0.85 : 0.7),
  };
}

export function enrichEbaySoldList(items: MarketEvidence[]): MarketEvidence[] {
  return items.map((row) =>
    row.source?.toLowerCase().includes("ebay") && row.kind === "sold"
      ? enrichEbaySoldEvidence(row)
      : row,
  );
}
