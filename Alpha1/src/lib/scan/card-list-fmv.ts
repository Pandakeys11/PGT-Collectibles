import type { ScanSpecimen } from "@/hooks/use-scan-session";
import { deriveFairValueResult, type FairValueBasis } from "@/lib/market/fair-value";
import { inferCardTargetGradeBucket } from "@/lib/market/market-intelligence";
import type { ExtractedCard, MarketEvidence } from "@/lib/scan/schemas";
import {
  filterMarketEvidence,
  sortEvidenceNewestFirst,
  type GradedGradeFilter,
} from "@/lib/scan/market-intelligence";
import { getAskingUsd } from "@/lib/scan/specimen-present";
import { formatFmvBasisLabel } from "@/lib/scan/sheet-present";

export type CardListFmv = {
  /** Market-derived FMV (comps / guide) — never the physical sticker alone. */
  fmvUsd: number | null;
  fmvBasis: FairValueBasis | null;
  fmvDisplay: string;
  fmvSubline: string | null;
  /** Price read from a sticker or handwritten tag on the slab/photo. */
  stickerUsd: number | null;
  stickerDisplay: string;
  hasSticker: boolean;
  latestSoldUsd: number | null;
  latestSoldDate: string | null;
  latestSoldSource: string | null;
  soldCompCount: number;
  hasMarketData: boolean;
};

function formatUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `$${Math.round(value).toLocaleString()}`;
}

function formatShortDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function soldWithPrice(item: MarketEvidence): boolean {
  return (
    item.kind === "sold" &&
    item.priceUsd != null &&
    Number.isFinite(item.priceUsd) &&
    item.priceUsd > 0
  );
}

function gradedFilterForCard(card: ExtractedCard): GradedGradeFilter {
  const bucket = inferCardTargetGradeBucket(card);
  switch (bucket) {
    case "psa10":
      return "psa10";
    case "psa9":
      return "psa9";
    case "bgsBlackLabel":
      return "bgsBlackLabel";
    case "cgcPristine10":
      return "cgcPristine10";
    case "bgs10":
      return "bgs10";
    case "cgc10":
      return "cgc10";
    default:
      return "other";
  }
}

/** Sold comps aligned to the scanned card lane and grade (raw vs PSA 9 vs CGC 10, etc.). */
function matchingSoldComps(specimen: ScanSpecimen): MarketEvidence[] {
  const evidence = specimen.context.marketEvidence.filter(soldWithPrice);
  if (evidence.length === 0) return [];

  const lane = specimen.context.lane === "graded" ? "graded" : "raw";
  const gradedGrade = lane === "graded" ? gradedFilterForCard(specimen.card) : "all";

  const strict = filterMarketEvidence(evidence, {
    lane,
    rawCondition: "all",
    gradedGrade,
    kind: "sold",
  });
  if (strict.length >= 1) return sortEvidenceNewestFirst(strict);

  const laneOnly = filterMarketEvidence(evidence, {
    lane,
    rawCondition: "all",
    gradedGrade: "all",
    kind: "sold",
  });
  if (laneOnly.length >= 1) return sortEvidenceNewestFirst(laneOnly);

  return sortEvidenceNewestFirst(evidence);
}

function resolveMarketFmvUsd(specimen: ScanSpecimen): {
  fmvUsd: number | null;
  fmvBasis: FairValueBasis | null;
} {
  const stored = specimen.context.fairValueUsd;
  const storedBasis = specimen.context.fairValueBasis ?? null;

  if (
    stored != null &&
    Number.isFinite(stored) &&
    stored > 0 &&
    storedBasis &&
    storedBasis !== "sticker_anchor"
  ) {
    return { fmvUsd: Math.round(stored), fmvBasis: storedBasis };
  }

  const derived = deriveFairValueResult(specimen.context.marketEvidence, {
    card: specimen.card,
    gradeCard: specimen.card,
    stickerUsd: null,
    targetGradeBucket: inferCardTargetGradeBucket(specimen.card),
  });

  if (
    derived.fairValueUsd != null &&
    Number.isFinite(derived.fairValueUsd) &&
    derived.fairValueBasis &&
    derived.fairValueBasis !== "sticker_anchor"
  ) {
    return {
      fmvUsd: Math.round(derived.fairValueUsd),
      fmvBasis: derived.fairValueBasis,
    };
  }

  return { fmvUsd: null, fmvBasis: null };
}

function buildSubline(
  fmvBasis: FairValueBasis | null,
  soldComps: MarketEvidence[],
  latest: MarketEvidence | null,
): string | null {
  const parts: string[] = [];
  const count = soldComps.length;

  if (count > 0) {
    parts.push(`${count} sold comp${count === 1 ? "" : "s"}`);
  }

  const basisLabel = formatFmvBasisLabel(fmvBasis);
  if (basisLabel) {
    parts.push(basisLabel);
  }

  if (latest?.priceUsd != null) {
    const date = formatShortDate(latest.observedAt);
    const src = latest.source?.trim();
    const tail = [formatUsd(latest.priceUsd), date, src].filter(Boolean).join(" · ");
    if (tail) parts.push(`Latest ${tail}`);
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * Single FMV for detected-card rows — uses enrich fair value when present, otherwise
 * the same grade-aware sold-median logic as market research.
 */
export function resolveCardListFmv(specimen: ScanSpecimen): CardListFmv {
  const { fmvUsd, fmvBasis } = resolveMarketFmvUsd(specimen);
  const stickerUsd = getAskingUsd(specimen);
  const soldComps = matchingSoldComps(specimen);
  const latest = soldComps[0] ?? null;

  const hasMarketData =
    fmvUsd != null ||
    soldComps.length > 0 ||
    specimen.context.marketEvidence.length > 0;

  const hasSticker =
    stickerUsd != null && Number.isFinite(stickerUsd) && stickerUsd >= 1;

  return {
    fmvUsd,
    fmvBasis,
    fmvDisplay: formatUsd(fmvUsd),
    fmvSubline: buildSubline(fmvBasis, soldComps, latest),
    stickerUsd: hasSticker ? Math.round(stickerUsd) : null,
    stickerDisplay: formatUsd(hasSticker ? stickerUsd : null),
    hasSticker,
    latestSoldUsd: latest?.priceUsd ?? null,
    latestSoldDate: latest?.observedAt ?? null,
    latestSoldSource: latest?.source ?? null,
    soldCompCount: soldComps.length,
    hasMarketData,
  };
}
