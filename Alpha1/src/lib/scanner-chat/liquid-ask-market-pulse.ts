import type { LiquidAskComp, LiquidAskMarketPulse } from "@/lib/scanner-chat/liquid-ask-types";
import { partitionComps } from "@/lib/scanner-chat/prioritize-comps";

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function fmtUsd(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

/** Desk-level sold vs ask read derived from research comps (feeds UI + LLM stance hints). */
export function deriveLiquidAskMarketPulse(comps: LiquidAskComp[]): LiquidAskMarketPulse | null {
  if (comps.length === 0) return null;

  const parts = partitionComps(comps);
  const soldPrices = [...parts.ebaySold, ...parts.otherSold]
    .map((c) => c.priceUsd)
    .filter((p): p is number => p != null && Number.isFinite(p));
  const activePrices = [...parts.ebayActive, ...parts.otherActive]
    .map((c) => c.priceUsd)
    .filter((p): p is number => p != null && Number.isFinite(p));

  const soldMedianUsd = median(soldPrices);
  const activeLowUsd = activePrices.length ? Math.min(...activePrices) : null;
  const soldCount = soldPrices.length;
  const activeCount = activePrices.length;

  let sentiment: LiquidAskMarketPulse["sentiment"] = "thin";
  if (soldCount >= 3 && soldMedianUsd != null) {
    if (activeLowUsd != null && activeLowUsd > soldMedianUsd * 1.08) sentiment = "bullish";
    else if (activeLowUsd != null && activeLowUsd < soldMedianUsd * 0.92) sentiment = "bearish";
    else sentiment = "neutral";
  } else if (soldCount >= 1) {
    sentiment = "neutral";
  }

  let stanceHint =
    "Thin comp coverage — open platform links below and verify grade/edition before buying, selling, or holding.";
  if (sentiment === "bullish" && soldMedianUsd != null) {
    stanceHint = `Sold support near ${fmtUsd(soldMedianUsd)} with asks above — holders may have pricing power; buyers should wait for grade-matched solds.`;
  } else if (sentiment === "bearish" && soldMedianUsd != null && activeLowUsd != null) {
    stanceHint = `Live asks (${fmtUsd(activeLowUsd)}) sit below recent sold medians (${fmtUsd(soldMedianUsd)}) — buyers may have leverage; sellers should anchor to sold comps.`;
  } else if (sentiment === "neutral" && soldMedianUsd != null) {
    stanceHint = `Sold median ~${fmtUsd(soldMedianUsd)} — market looks balanced; edition and grade-matched comps drive the real decision.`;
  }

  return {
    soldMedianUsd,
    activeLowUsd,
    soldCount,
    activeCount,
    sentiment,
    stanceHint,
  };
}
