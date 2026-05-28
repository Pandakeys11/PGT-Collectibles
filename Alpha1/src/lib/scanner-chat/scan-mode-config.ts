import type { ScanLaneMode } from "@/lib/scan/build-specimens";
import type { ScanMode } from "./types";

/** Maps chat scan modes to the legacy lane filter used by vision + enrich. */
export function scanModeToLane(mode: ScanMode): ScanLaneMode {
  if (mode === "graded") return "graded";
  return "all";
}

/** Deep Match — optional second vision verify pass (OpenRouter/Groq, not Gemini when skipped). */
export function scanModeRequestsVisionVerify(mode: ScanMode): boolean {
  return mode === "deep";
}

/** Binder Page Mode — tile the photo and extract each grid region (multi-card). */
export function scanModeUsesBinderGrid(
  mode: ScanMode,
  imageCount: number,
  laneMode: ScanLaneMode,
): boolean {
  return imageCount === 1 && mode === "binder" && laneMode !== "graded";
}

/** Singles / slabs — focused prompt + smaller upload (not full-page binder tiling). */
export function scanModeUsesSingleCardCrop(
  mode: ScanMode,
  imageCount: number,
  laneMode: ScanLaneMode,
): boolean {
  if (imageCount !== 1) return false;
  if (laneMode === "graded") return true;
  return mode === "fast" || mode === "deep" || mode === "market";
}

/** Upload prep: binder pages keep higher resolution for tiling. */
export function scanModeUsesBinderUploadPrep(
  mode: ScanMode,
  slotCount: number,
  laneMode: ScanLaneMode,
): boolean {
  return slotCount === 1 && scanModeUsesBinderGrid(mode, 1, laneMode);
}
