import type { ScanMode } from "./types";

export const SCAN_MODE_OPTIONS: { id: ScanMode; label: string; description: string }[] = [
  {
    id: "fast",
    label: "Fast Scan",
    description: "Single card or photo — one vision pass, catalog + market after",
  },
  {
    id: "deep",
    label: "Deep Match",
    description: "Same as Fast plus verify pass when extraction looks weak",
  },
  {
    id: "market",
    label: "Market Analysis",
    description: "Single-card extract — same pipeline; comps load in Scan Intelligence",
  },
  {
    id: "graded",
    label: "Graded Card Mode",
    description: "Slab label + cert OCR; registry hydrates before catalog match",
  },
  {
    id: "binder",
    label: "Binder Page Mode",
    description: "Full page — tiled vision for every visible card in the grid",
  },
];

export function scanModeLabel(mode: ScanMode): string {
  return SCAN_MODE_OPTIONS.find((o) => o.id === mode)?.label ?? mode;
}
