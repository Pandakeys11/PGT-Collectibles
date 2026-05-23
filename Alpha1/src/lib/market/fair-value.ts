import type { ExtractedCard, MarketEvidence } from "@/lib/scan/schemas";
import { analyzeMarketEvidence, type GradeBucket } from "@/lib/market/market-intelligence";

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

export type FairValueBasis =
  | "sold_median"
  | "active_median"
  | "reference_median"
  | "sticker_anchor"
  | "tcg_catalog"
  | "target_sold_median"
  | "target_active_median"
  | "target_reference_median"
  | "nearest_sold_median";

export function deriveFairValueResult(
  evidence: MarketEvidence[],
  options?: {
    card?: Pick<ExtractedCard, "printStamps" | "details"> | null;
    gradeCard?: ExtractedCard | null;
    stickerUsd?: number | null;
    targetGradeBucket?: GradeBucket | null;
  },
): { fairValueUsd: number | null; fairValueBasis: FairValueBasis | null } {
  const intelligence = analyzeMarketEvidence(evidence, {
    card: options?.card ?? null,
    gradeCard: options?.gradeCard ?? null,
    stickerUsd: options?.stickerUsd,
    targetGradeBucket: options?.targetGradeBucket ?? null,
  });
  if (intelligence.fmvUsd != null && intelligence.fmvBasis) {
    return { fairValueUsd: intelligence.fmvUsd, fairValueBasis: intelligence.fmvBasis };
  }

  const pricesFor = (kind: MarketEvidence["kind"]) =>
    evidence
      .filter((item) => item.kind === kind && typeof item.priceUsd === "number" && Number.isFinite(item.priceUsd!))
      .map((item) => item.priceUsd as number);

  const sold = median(pricesFor("sold"));
  if (sold != null) return { fairValueUsd: sold, fairValueBasis: "sold_median" };

  const active = median(pricesFor("active"));
  if (active != null) return { fairValueUsd: active, fairValueBasis: "active_median" };

  const reference = median(pricesFor("reference"));
  if (reference != null) return { fairValueUsd: reference, fairValueBasis: "reference_median" };

  const sticker = options?.stickerUsd;
  if (typeof sticker === "number" && Number.isFinite(sticker) && sticker >= 1 && sticker < 500_000) {
    return { fairValueUsd: Math.round(sticker), fairValueBasis: "sticker_anchor" };
  }

  return { fairValueUsd: null, fairValueBasis: null };
}

