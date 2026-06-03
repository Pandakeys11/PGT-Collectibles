/** PGT-owned US market trend (7d vs 30d) — stored on catalog price snapshots. */

export type PgtUsTrendLane = "sold_comps" | "tcg_anchor" | "price_ticks" | "blended";

export type PgtUsTrendMeta = {
  momentumPct: number | null;
  median7dUsd: number | null;
  median30dUsd: number | null;
  lane: PgtUsTrendLane;
  comps7d: number;
  comps30d: number;
  syncedAt: string;
};

export type PgtUsTrendResult = {
  meta: PgtUsTrendMeta;
  pct: number;
  window7dUsd: number;
  window30dUsd: number;
};
