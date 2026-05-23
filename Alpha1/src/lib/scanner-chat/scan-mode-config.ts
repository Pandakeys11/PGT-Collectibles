import type { ScanLaneMode } from "@/lib/scan/build-specimens";
import type { ScanMode } from "./types";

/** Maps chat scan modes to the legacy lane filter used by vision + enrich. */
export function scanModeToLane(mode: ScanMode): ScanLaneMode {
  if (mode === "graded") return "graded";
  return "all";
}
