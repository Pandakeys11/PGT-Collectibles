import type { ScanSpecimen } from "@/hooks/use-scan-session";
import { getCardDisplayTitle } from "@/lib/scan/card-display";
import {
  formatGradedSlabTag,
  hasReadableCertNumber,
  isCertNotApplicable,
  normalizeGradedSlabFields,
} from "@/lib/scan/graded-slab";
import { resolveCardListFmv } from "@/lib/scan/card-list-fmv";
import {
  displayPrintPromo,
  displayPrintVersion,
} from "@/lib/scan/display-print-edition";
import { catalogVariantLabelFromCatalogId } from "@/lib/scan/print-identity-ui";
import { buildScanCompChips } from "@/lib/scan/scan-market-present";
import { marketDataReady, summarizeSources } from "@/lib/scan/sheet-present";
import {
  resolveSpecimenPipelinePhase,
  type ScanPresentContext,
} from "@/lib/scan/specimen-pipeline-present";
import type { CardMatch, MatchStatus, ScanSummary } from "./types";

function matchStatus(specimen: ScanSpecimen): MatchStatus {
  const { catalogIdentityStatus, verificationStatus, catalogCandidates } = specimen.context;
  if (
    catalogIdentityStatus === "failed" ||
    (catalogIdentityStatus === "ambiguous" && catalogCandidates.length > 1)
  ) {
    return "ambiguous";
  }
  if (verificationStatus === "verified" && catalogIdentityStatus === "confirmed") {
    return "verified";
  }
  if (catalogIdentityStatus === "confirmed" && verificationStatus !== "failed") {
    return "verified";
  }
  return "review";
}

function confidencePercent(specimen: ScanSpecimen): number {
  const c = specimen.context.catalogConfidence ?? specimen.context.confidence ?? 0;
  return Math.min(100, Math.max(0, Math.round(c * 100)));
}

const GRADIENTS = [
  "from-orange-500/40 via-amber-400/30 to-red-600/40",
  "from-yellow-400/40 via-amber-300/30 to-orange-400/40",
  "from-violet-500/40 via-fuchsia-400/30 to-pink-500/40",
  "from-indigo-600/40 via-purple-500/30 to-slate-700/40",
  "from-emerald-500/35 via-teal-400/25 to-cyan-600/35",
] as const;

export function specimenToCardMatch(
  specimen: ScanSpecimen,
  index: number,
  present?: ScanPresentContext,
): CardMatch {
  const { card, context } = specimen;
  const pipeline = resolveSpecimenPipelinePhase(specimen, present);
  const slabCard =
    context.lane === "graded" ? normalizeGradedSlabFields(card, "graded") : card;
  const gradedTag =
    context.lane === "graded" ? formatGradedSlabTag(slabCard, "graded") : null;
  const fmv = resolveCardListFmv(specimen);
  const scanMarketReady = marketDataReady(specimen);
  const compChips = scanMarketReady ? buildScanCompChips(specimen) : null;
  const catalogVariant = catalogVariantLabelFromCatalogId(context.catalogId);
  const printVersion =
    displayPrintVersion(card, catalogVariant ?? context.variantLabel) ||
    catalogVariant ||
    "";
  const printPromo = displayPrintPromo(card, context.variantLabel);
  const sources = summarizeSources(specimen).map((s) => s.label);
  const fmvAmount = fmv.fmvUsd ?? 0;
  const graded =
    gradedTag || slabCard.grader || slabCard.grade || slabCard.cert
      ? {
          company: slabCard.grader ?? "Graded",
          grade: slabCard.grade ?? "—",
          cert: hasReadableCertNumber(slabCard.cert)
            ? slabCard.cert!.replace(/\D/g, "")
            : isCertNotApplicable(slabCard.cert)
              ? "NA"
              : undefined,
        }
      : undefined;

  return {
    id: specimen.id,
    specimenId: specimen.id,
    name: getCardDisplayTitle(slabCard),
    setName: context.setName ?? slabCard.set ?? "—",
    setNumber: context.cardNumber ?? slabCard.number ?? "—",
    year: context.year ?? slabCard.year ?? "—",
    rarity: slabCard.rarity ?? "—",
    printVersion: printVersion || undefined,
    printPromo: printPromo || undefined,
    catalogId: context.catalogId ?? null,
    condition: slabCard.details?.trim() || undefined,
    graded,
    confidence: confidencePercent(specimen),
    fmvUsd: fmv.fmvUsd,
    fmvDisplay: fmv.fmvDisplay,
    fmvSubline: fmv.fmvSubline,
    fmvBasis: fmv.fmvBasis,
    fmvHeld: fmv.fmvHeld,
    fmvHoldMessage: fmv.fmvHoldMessage,
    compRawSold: compChips?.rawSold,
    compPsa10Sold: compChips?.psa10Sold,
    compListed: compChips?.listed,
    stickerUsd: fmv.stickerUsd,
    stickerDisplay: fmv.stickerDisplay,
    hasSticker: fmv.hasSticker,
    latestSoldUsd: fmv.latestSoldUsd,
    soldCompCount: fmv.soldCompCount,
    marketLow: fmvAmount,
    marketHigh: fmvAmount,
    sources,
    status: matchStatus(specimen),
    thumbnailGradient: GRADIENTS[index % GRADIENTS.length]!,
    catalogImageUrl: context.catalogImageUrl ?? null,
    catalogImageSource: context.catalogImageSource ?? null,
    catalogImageSourceLabel: context.catalogImageSourceLabel ?? null,
    catalogImageNeedsReview: context.catalogImageNeedsReview ?? false,
    previewUrl: specimen.previewUrl,
    extractedCard: slabCard,
    verificationStatus: context.verificationStatus,
    catalogIdentityStatus: context.catalogIdentityStatus,
    fairValueUsd: context.fairValueUsd,
    pipelinePhase: pipeline.phase,
    catalogPending: pipeline.catalogPending,
    marketPending: pipeline.marketPending,
  };
}

export function buildScanSummaryFromSpecimens(specimens: ScanSpecimen[]): ScanSummary {
  const cards = specimens.map((s, i) => specimenToCardMatch(s, i));
  const highConfidence = cards.filter((c) => c.confidence >= 80 && c.status === "verified").length;
  const needsReview = cards.filter((c) => c.status !== "verified").length;
  const estimatedTotal = cards.reduce((sum, c) => sum + (c.fmvUsd ?? 0), 0);
  const best = [...cards].sort((a, b) => (b.fmvUsd ?? 0) - (a.fmvUsd ?? 0))[0];
  return {
    totalDetected: cards.length,
    highConfidence,
    needsReview,
    estimatedTotal,
    bestHit:
      best?.fmvUsd != null && best.fmvUsd > 0
        ? { name: best.name, fmv: best.fmvUsd }
        : undefined,
  };
}

export function buildBatchScanAssistantText(
  specimens: ScanSpecimen[],
  summary: ScanSummary,
): string {
  if (specimens.length === 0) {
    return "No cards were detected in this upload. Try a clearer photo, tighter framing, or a flatter binder page.";
  }

  const verified = specimens.filter((s) => matchStatus(s) === "verified").length;
  const review = specimens.filter((s) => matchStatus(s) === "review").length;
  const uncertain = specimens.filter((s) => matchStatus(s) === "ambiguous").length;

  const parts = [
    `I found ${summary.totalDetected} card${summary.totalDetected === 1 ? "" : "s"} in this upload.`,
    `${verified} ${verified === 1 ? "is a" : "are"} verified catalog match${verified === 1 ? "" : "es"} with market comps.`,
  ];

  if (review > 0) {
    parts.push(
      `${review} need review — set symbol, number, or crop may be partially blocked.`,
    );
  }
  if (uncertain > 0) {
    parts.push(`${uncertain} have ambiguous identity and should be confirmed manually.`);
  }
  if (summary.estimatedTotal > 0) {
    parts.push(
      `Estimated session FMV total is about $${summary.estimatedTotal.toLocaleString()} from grade-aware sold comps.`,
    );
  }
  if (summary.bestHit) {
    parts.push(
      `Top hit: ${summary.bestHit.name} — FMV about $${summary.bestHit.fmv.toLocaleString()}.`,
    );
  }
  parts.push(
    "A detailed session intelligence report — market sentiment, hype narratives, and card-by-card insight — is generating below.",
  );
  parts.push("Review uncertain rows, then export CSV or JSON when ready.");

  return parts.join(" ");
}

/** Map legacy progress strings to pipeline step keys for the timeline UI. */
export function progressToScanStep(progress: string | null): import("./types").SystemScanStep | null {
  if (!progress) return null;
  const p = progress.toLowerCase();
  if (p.includes("vision") || p.includes("extract")) return "detect";
  if (p.includes("precision")) return "match";
  if (p.includes("enriching") || p.includes("catalog")) return "set-year";
  if (p.includes("market")) return "market";
  if (p.includes("complete")) return "finalize";
  return "preprocess";
}
