import type { ScanMode } from "./types";

export const SCAN_MODE_OPTIONS: { id: ScanMode; label: string; description: string }[] = [
  { id: "fast", label: "Fast Scan", description: "Quick detect & match" },
  { id: "deep", label: "Deep Match", description: "Artwork + set verification" },
  { id: "market", label: "Market Analysis", description: "Comps & value ranges" },
  { id: "graded", label: "Graded Card Mode", description: "Slab label + cert focus" },
  { id: "binder", label: "Binder Page Mode", description: "Batch grid extraction" },
];

export function scanModeLabel(mode: ScanMode): string {
  return SCAN_MODE_OPTIONS.find((o) => o.id === mode)?.label ?? mode;
}
