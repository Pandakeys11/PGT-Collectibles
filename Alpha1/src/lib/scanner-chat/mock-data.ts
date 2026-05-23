import type { SystemScanStep } from "./types";

/** Labels shown in the Liquid Scan progress timeline during vision + enrich. */
export const SYSTEM_SCAN_STEPS: { step: SystemScanStep; label: string }[] = [
  { step: "preprocess", label: "Image preprocessing" },
  { step: "detect", label: "Detecting card boundaries" },
  { step: "match", label: "Matching artwork" },
  { step: "set-year", label: "Checking set/year" },
  { step: "market", label: "Fetching market comps" },
  { step: "finalize", label: "Building final list" },
];
