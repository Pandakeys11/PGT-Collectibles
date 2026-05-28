import type { LiquidAskResearch } from "@/lib/scanner-chat/liquid-ask-types";
import type { ScanCardContext } from "@/lib/scan/schemas";

export type MarketMasterVerificationStatus =
  | "verified"
  | "high_confidence"
  | "medium_confidence"
  | "low_confidence"
  | "manual_review_needed";

export type LiquidAskConfidenceHints = {
  extractionConfidence: number;
  marketConfidence: number;
  gradingConfidence: number;
  overallConfidence: number;
  extractionStatus: MarketMasterVerificationStatus;
  marketStatus: MarketMasterVerificationStatus;
  gradingStatus: MarketMasterVerificationStatus;
  overallStatus: MarketMasterVerificationStatus;
  extractionReason: string;
  marketReason: string;
  gradingReason: string;
  overallReason: string;
};

function statusFromScore(score: number): MarketMasterVerificationStatus {
  if (score >= 0.88) return "verified";
  if (score >= 0.72) return "high_confidence";
  if (score >= 0.5) return "medium_confidence";
  if (score >= 0.32) return "low_confidence";
  return "manual_review_needed";
}

function label(status: MarketMasterVerificationStatus): string {
  switch (status) {
    case "verified":
      return "High";
    case "high_confidence":
      return "High";
    case "medium_confidence":
      return "Medium";
    case "low_confidence":
      return "Low";
    default:
      return "Low — review recommended";
  }
}

/** Deterministic confidence hints from research pack + optional focus card (guides LLM Confidence section). */
export function deriveLiquidAskConfidenceHints(args: {
  research: LiquidAskResearch | null;
  focus?: ScanCardContext | null;
  contextCount: number;
}): LiquidAskConfidenceHints | null {
  const { research, focus, contextCount } = args;
  if (!research && contextCount === 0) return null;

  let extraction = 0.45;
  let extractionReason = "No scan context — identity not verified from upload.";

  if (focus) {
    if (focus.catalogIdentityStatus === "confirmed" && focus.verificationStatus === "verified") {
      extraction = 0.92;
      extractionReason = "Catalog identity confirmed and verification verified in session.";
    } else if (focus.catalogIdentityStatus === "confirmed") {
      extraction = 0.78;
      extractionReason = "Catalog match confirmed; check blockers for remaining ambiguity.";
    } else if (focus.catalogIdentityStatus === "ambiguous") {
      extraction = 0.42;
      extractionReason = "Ambiguous catalog match — confirm set, number, and edition.";
    } else {
      extraction = 0.55;
      extractionReason = "Partial identity — manual confirm recommended.";
    }
    if (focus.blockers?.length) {
      extraction = Math.min(extraction, 0.48);
      extractionReason = `Blockers present: ${focus.blockers.slice(0, 2).join("; ")}.`;
    }
  } else if (contextCount > 0) {
    extraction = 0.62;
    extractionReason = "Session has multiple cards — focus a specimen for tighter identity confidence.";
  }

  const sold = research?.comps.filter((c) => c.kind === "sold" && c.priceUsd != null).length ?? 0;
  const live = research?.liveResearchUsed ?? false;
  const ebaySold = research?.dataCoverage.ebaySoldCount ?? 0;
  let market = 0.35;
  let marketReason = "No live comps in research pack.";

  if (sold >= 6 && live) {
    market = 0.88;
    marketReason = `${sold} sold comp(s) from live research (${ebaySold} eBay sold).`;
  } else if (sold >= 3 && live) {
    market = 0.72;
    marketReason = `${sold} sold comp(s); consider more grade-matched sales for graded cards.`;
  } else if (sold >= 1 || research?.webBrief) {
    market = 0.55;
    marketReason = live
      ? "Thin sold data — ranges directional; verify on source links."
      : "Web brief only — treat prices as indicative.";
  } else if (focus?.fairValueUsd != null) {
    market = 0.5;
    marketReason = "Session FMV only — session comps may be stale vs question time.";
  }

  const certCount = research?.certLookups.filter((c) => c.verified).length ?? 0;
  const graded = Boolean(focus?.extraction && typeof focus.extraction === "object" && (focus.extraction as { grader?: string }).grader);
  let grading = 0.5;
  let gradingReason = "Raw or grade not specified.";

  if (certCount > 0) {
    grading = 0.9;
    gradingReason = `Cert verified via ${research!.certLookups[0]?.dataProvider ?? "registry"}.`;
  } else if (graded) {
    grading = 0.58;
    gradingReason = "Graded label in scan without verified cert lookup — confirm cert number.";
  } else {
    grading = 0.52;
    gradingReason = "Raw condition discussion only — no slab registry data.";
  }

  const overall = extraction * 0.4 + market * 0.4 + grading * 0.2;
  const extractionStatus = statusFromScore(extraction);
  const marketStatus = statusFromScore(market);
  const gradingStatus = statusFromScore(grading);
  const overallStatus = statusFromScore(overall);

  return {
    extractionConfidence: Math.round(extraction * 100) / 100,
    marketConfidence: Math.round(market * 100) / 100,
    gradingConfidence: Math.round(grading * 100) / 100,
    overallConfidence: Math.round(overall * 100) / 100,
    extractionStatus,
    marketStatus,
    gradingStatus,
    overallStatus,
    extractionReason,
    marketReason,
    gradingReason,
    overallReason: `Weighted blend of identity (${label(extractionStatus)}), market (${label(marketStatus)}), grading (${label(gradingStatus)}).`,
  };
}

/** Markdown block appended to LLM user prompt. */
export function formatConfidenceHintsForLlm(hints: LiquidAskConfidenceHints): string {
  return [
    "Confidence hints (reflect accurately in your ## Confidence section; do not invent higher certainty):",
    JSON.stringify(
      {
        extraction: { score: hints.extractionConfidence, status: hints.extractionStatus, reason: hints.extractionReason },
        market: { score: hints.marketConfidence, status: hints.marketStatus, reason: hints.marketReason },
        grading: { score: hints.gradingConfidence, status: hints.gradingStatus, reason: hints.gradingReason },
        overall: { score: hints.overallConfidence, status: hints.overallStatus, reason: hints.overallReason },
      },
      null,
      0,
    ),
  ].join("\n");
}
