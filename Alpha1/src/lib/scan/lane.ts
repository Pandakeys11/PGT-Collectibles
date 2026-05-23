import { normalizeVisionGridLocation, type VisionGridLocation } from "@/lib/scan/spatial";

export type BinderVisionLane = "raw" | "graded";

export type LaneClassification = {
  lane: BinderVisionLane;
  confidence: number;
};

export type BinderScanGradedProbe = {
  visionLane?: string | null;
  visionLaneConfidence?: number | null;
  encapsulation?: string | null;
  grade?: string | null;
  rarity?: string | null;
  grader?: string | null;
  details?: string | null;
  labelTitle?: string | null;
  cert?: string | null;
};

function extractGraderPrefix(value: string | null | undefined): string | null {
  const text = String(value ?? "").toUpperCase();
  if (text.includes("PSA")) return "PSA";
  if (text.includes("CGC")) return "CGC";
  if (text.includes("BGS")) return "BGS";
  if (text.includes("BVG")) return "BVG";
  if (text.includes("SGC")) return "SGC";
  if (text.includes("ACE")) return "ACE";
  if (text.includes("TAG")) return "TAG";
  if (text.includes("HGA")) return "HGA";
  if (text.includes("GMA")) return "GMA";
  return null;
}

function combinedGradeText(card: BinderScanGradedProbe): string {
  return [card.grade, card.rarity, card.grader, card.details, card.labelTitle].filter(Boolean).join(" ");
}

export function encapsulationLooksRaw(value: string | null | undefined): boolean {
  const e = String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
  return /^(raw|loose|binder|binder_pocket|sleeve|toploader|top_loader|in_binder|page|sheet)$/.test(e);
}

export function encapsulationLooksGraded(value: string | null | undefined): boolean {
  const e = String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
  return /^(graded|graded_slab|slab|encapsulated|holder)$/.test(e);
}

export function isBinderScanGraded(card: BinderScanGradedProbe): boolean {
  const vl = String(card.visionLane ?? "").toLowerCase();
  if (vl === "graded") return true;
  if (vl === "raw") return false;

  if (encapsulationLooksGraded(card.encapsulation)) return true;
  if (encapsulationLooksRaw(card.encapsulation)) return false;

  const gradeText = combinedGradeText(card);
  if (!gradeText.trim()) return false;
  if (/\braw\b/i.test(gradeText)) return false;

  const grader =
    extractGraderPrefix(card.grader) ??
    extractGraderPrefix(card.grade) ??
    extractGraderPrefix(card.rarity) ??
    extractGraderPrefix(card.details) ??
    extractGraderPrefix(card.labelTitle);

  if (grader) {
    return /\b(10|9\.5|9|8\.5|8|7\.5|7|6|5|4|3|2|1)\b/.test(gradeText);
  }

  return /\b(gem\s*mint|near\s*mint|black\s*label|pristine|beckett)\b/i.test(gradeText);
}

export function pickVisionProvenanceFields(raw: Record<string, unknown>): {
  encapsulation?: string;
  visionLane?: BinderVisionLane;
  visionLaneConfidence?: number;
  sourceImageIndex?: number | null;
  visionBatchMerged?: boolean;
  location?: VisionGridLocation;
} {
  const vl = typeof raw.visionLane === "string" ? raw.visionLane.toLowerCase().trim() : "";
  const visionLane = vl === "raw" || vl === "graded" ? (vl as BinderVisionLane) : undefined;
  const sourceImageIndex =
    typeof raw.sourceImageIndex === "number"
      ? raw.sourceImageIndex
      : raw.sourceImageIndex === null
        ? null
        : undefined;
  return {
    encapsulation: raw.encapsulation != null ? String(raw.encapsulation).trim() : undefined,
    visionLane,
    visionLaneConfidence:
      typeof raw.visionLaneConfidence === "number" && Number.isFinite(raw.visionLaneConfidence)
        ? raw.visionLaneConfidence
        : undefined,
    sourceImageIndex,
    visionBatchMerged:
      typeof raw.visionBatchMerged === "boolean" ? raw.visionBatchMerged : undefined,
    location: normalizeVisionGridLocation(raw.location),
  };
}

export function classifyCardLane(card: Record<string, unknown>): LaneClassification {
  const probe = card as BinderScanGradedProbe;
  const enc = String(probe.encapsulation ?? "").trim();

  if (encapsulationLooksGraded(enc)) {
    return { lane: "graded", confidence: 0.92 };
  }

  const labelText = String(probe.labelTitle ?? "").toLowerCase();
  const detailsText = String(probe.details ?? "").toLowerCase();
  const slabCueBlob = `${labelText} ${detailsText}`;
  const graderBlob = [probe.grader, probe.grade, probe.labelTitle].filter(Boolean).join(" ").toUpperCase();

  const graderAcronym = /\b(PSA|CGC|BGS|BVG|SGC|ACE|TAG|HGA|GMA)\b/.test(graderBlob) ? 0.45 : 0;
  const slabHolderCue = /\b(slab|graded|certification|population|gem\s*mint|black\s*label)\b/i.test(slabCueBlob)
    ? 0.22
    : 0;
  const gradeWithGrader =
    graderAcronym > 0 && /\b(10|9\.5|9|8\.5|8|7\.5|7|6|5|4|3|2|1)\b/.test(graderBlob) ? 0.22 : 0;

  const certDigits = String(probe.cert ?? "").replace(/\D/g, "");
  const certIsNa = /^(NA|N\/A)$/i.test(String(probe.cert ?? "").trim());
  const certSignal =
    graderAcronym > 0 && !certIsNa && certDigits.length >= 6 ? 0.26 : 0;

  const confidence = Math.min(1, graderAcronym + slabHolderCue + gradeWithGrader + certSignal);
  if (confidence >= 0.55) {
    return { lane: "graded", confidence };
  }
  if (encapsulationLooksRaw(enc)) {
    return { lane: "raw", confidence: 0.92 };
  }
  return { lane: "raw", confidence: Math.max(0.08, 1 - confidence) };
}

export function scrubHallucinatedSlabFieldsForRaw<T extends Record<string, unknown>>(card: T): T {
  return {
    ...card,
    grader: undefined,
    grade: undefined,
    cert: "",
  } as T;
}
