import { inferMarketVenueType } from "@/lib/market/market-intelligence";
import {
  matchesBgsBlackLabel,
  matchesCgcPristine10,
  matchesPsa10,
} from "@/lib/market/grade-match";
import type { MarketEvidence } from "@/lib/scan/schemas";

export type HeatmapLaneId = "sold" | "listed" | "auction" | "premium";

export type HeatmapLaneMeta = {
  id: HeatmapLaneId;
  label: string;
  short: string;
  fill: string;
  glow: string;
  ring: string;
  dotClass: string;
};

export const HEATMAP_LANES: HeatmapLaneMeta[] = [
  {
    id: "sold",
    label: "Sold",
    short: "Sold",
    fill: "rgba(52, 211, 153, 0.55)",
    glow: "rgba(52, 211, 153, 0.35)",
    ring: "rgba(52, 211, 153, 0.85)",
    dotClass: "bg-emerald-400",
  },
  {
    id: "listed",
    label: "Listed",
    short: "Asks",
    fill: "rgba(251, 191, 36, 0.55)",
    glow: "rgba(251, 191, 36, 0.35)",
    ring: "rgba(251, 191, 36, 0.85)",
    dotClass: "bg-amber-400",
  },
  {
    id: "auction",
    label: "Auctions",
    short: "Auction",
    fill: "rgba(167, 139, 250, 0.55)",
    glow: "rgba(167, 139, 250, 0.35)",
    ring: "rgba(167, 139, 250, 0.85)",
    dotClass: "bg-violet-400",
  },
  {
    id: "premium",
    label: "Premium graded",
    short: "Premium",
    fill: "rgba(251, 113, 133, 0.55)",
    glow: "rgba(251, 113, 133, 0.35)",
    ring: "rgba(251, 113, 133, 0.85)",
    dotClass: "bg-rose-400",
  },
];

function haystack(item: MarketEvidence): string {
  return `${item.slab ?? ""} ${item.title} ${item.source ?? ""}`.toLowerCase();
}

export function classifyHeatmapLane(item: MarketEvidence): HeatmapLaneId | null {
  const price = item.priceUsd;
  if (price == null || !Number.isFinite(price) || price <= 0) return null;

  if (matchesPsa10(item) || matchesBgsBlackLabel(item) || matchesCgcPristine10(item)) {
    return "premium";
  }

  const venue = inferMarketVenueType(item);
  const h = haystack(item);
  const auctionLike =
    venue === "auction" ||
    /auction|pwcc|goldin|heritage|fanatics collect|hammer/i.test(h);

  if (auctionLike) return "auction";
  if (item.kind === "sold") return "sold";
  if (item.kind === "active") return "listed";
  if (item.kind === "reference") return "listed";
  return null;
}

/** Compact axis / bubble label — always readable width. */
export function formatPriceCompact(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  if (value < 1_000) return `$${Math.round(value)}`;
  if (value < 10_000) return `$${(value / 1_000).toFixed(value >= 5_000 ? 0 : 1)}k`;
  if (value < 1_000_000) return `$${Math.round(value / 1_000)}k`;
  return `$${(value / 1_000_000).toFixed(1)}M`;
}

export function formatPriceRange(minUsd: number, maxUsd: number): string {
  if (Math.abs(maxUsd - minUsd) < Math.max(5, minUsd * 0.04)) {
    return formatPriceCompact(minUsd);
  }
  return `${formatPriceCompact(minUsd)}–${formatPriceCompact(maxUsd)}`;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function log10(price: number): number {
  return Math.log10(Math.max(1, price));
}

/** 0–100 position on log price axis. */
export function priceToLogPct(price: number, minUsd: number, maxUsd: number): number {
  const lo = log10(minUsd);
  const hi = log10(maxUsd);
  if (hi <= lo) return 50;
  const t = (log10(price) - lo) / (hi - lo);
  return Math.min(98, Math.max(2, t * 100));
}

export type PriceBubbleCluster = {
  lane: HeatmapLaneId;
  priceUsd: number;
  minUsd: number;
  maxUsd: number;
  count: number;
  xPct: number;
  size: number;
  label: string;
  title: string;
};

export type PriceAxisTick = {
  xPct: number;
  label: string;
  usd: number;
};

export type MarketBubbleInsight = {
  tone: "neutral" | "positive" | "warning" | "info";
  text: string;
};

export type MarketPriceBubbleModel = {
  scaleMinUsd: number;
  scaleMaxUsd: number;
  rangeLabel: string;
  fmvUsd: number | null;
  fmvXPct: number | null;
  axisTicks: PriceAxisTick[];
  laneBubbles: Record<HeatmapLaneId, PriceBubbleCluster[]>;
  totalByLane: Record<HeatmapLaneId, number>;
  headline: string;
  insights: MarketBubbleInsight[];
  pricedCount: number;
};

type ClusterAcc = {
  minUsd: number;
  maxUsd: number;
  count: number;
  sum: number;
};

function clusterLanePrices(
  prices: number[],
  minUsd: number,
  maxUsd: number,
  lane: HeatmapLaneId,
  mergeRatio = 0.14,
): PriceBubbleCluster[] {
  if (prices.length === 0) return [];
  const sorted = [...prices].sort((a, b) => a - b);
  const groups: ClusterAcc[] = [];

  for (const price of sorted) {
    const last = groups[groups.length - 1];
    if (last && price <= last.maxUsd * (1 + mergeRatio)) {
      last.count += 1;
      last.sum += price;
      last.maxUsd = Math.max(last.maxUsd, price);
      last.minUsd = Math.min(last.minUsd, price);
    } else {
      groups.push({ minUsd: price, maxUsd: price, count: 1, sum: price });
    }
  }

  const maxCount = Math.max(...groups.map((g) => g.count), 1);

  return groups.map((g) => {
    const priceUsd = g.sum / g.count;
    const label =
      g.count === 1
        ? formatPriceCompact(priceUsd)
        : String(g.count);
    return {
      lane,
      priceUsd,
      minUsd: g.minUsd,
      maxUsd: g.maxUsd,
      count: g.count,
      xPct: priceToLogPct(priceUsd, minUsd, maxUsd),
      size: 14 + (g.count / maxCount) * 22,
      label,
      title:
        g.count === 1
          ? `${HEATMAP_LANES.find((l) => l.id === lane)?.label}: ${formatPriceCompact(priceUsd)}`
          : `${g.count} comps · ${formatPriceRange(g.minUsd, g.maxUsd)}`,
    };
  });
}

function logSpacedTicks(minUsd: number, maxUsd: number, count = 5): PriceAxisTick[] {
  const lo = log10(minUsd);
  const hi = log10(maxUsd);
  const ticks: PriceAxisTick[] = [];
  for (let i = 0; i < count; i++) {
    const t = count <= 1 ? 0.5 : i / (count - 1);
    const usd = Math.pow(10, lo + t * (hi - lo));
    ticks.push({
      usd,
      label: formatPriceCompact(usd),
      xPct: priceToLogPct(usd, minUsd, maxUsd),
    });
  }
  return ticks;
}

function lanePrices(
  evidence: MarketEvidence[],
  lane: HeatmapLaneId,
): number[] {
  return evidence
    .filter((item) => classifyHeatmapLane(item) === lane)
    .map((item) => item.priceUsd as number);
}

function buildBubbleInsights(
  totalByLane: Record<HeatmapLaneId, number>,
  soldPrices: number[],
  listedPrices: number[],
  premiumPrices: number[],
  fmvUsd: number | null,
): { headline: string; insights: MarketBubbleInsight[] } {
  const insights: MarketBubbleInsight[] = [];
  const soldMed = median(soldPrices);
  const askMed = median(listedPrices);
  const premMed = median(premiumPrices);

  if (fmvUsd != null) {
    insights.push({
      tone: "info",
      text: `Adjusted FMV is ${formatPriceCompact(fmvUsd)} — cyan line on the chart.`,
    });
  }

  if (soldMed != null) {
    insights.push({
      tone: "positive",
      text: `Sold prints center around ${formatPriceCompact(soldMed)} (${soldPrices.length} comp${soldPrices.length === 1 ? "" : "s"}).`,
    });
  } else if (totalByLane.sold === 0 && totalByLane.listed > 0) {
    insights.push({
      tone: "warning",
      text: "No sold comps yet — yellow bubbles are asks only; verify with eBay sold search.",
    });
  }

  if (askMed != null) {
    insights.push({
      tone: "neutral",
      text: `Live asks center around ${formatPriceCompact(askMed)} (${listedPrices.length} listing${listedPrices.length === 1 ? "" : "s"}).`,
    });
  }

  if (soldMed != null && askMed != null) {
    const gapPct = ((askMed - soldMed) / soldMed) * 100;
    if (gapPct > 12) {
      insights.push({
        tone: "warning",
        text: `Ask/sold gap ~${Math.round(gapPct)}% — listings sit above last sales; check grade or condition.`,
      });
    } else if (gapPct < -12) {
      insights.push({
        tone: "positive",
        text: `Asks run below sold median — potential buy zone if titles match.`,
      });
    }
  }

  if (premMed != null && fmvUsd != null && premMed > fmvUsd * 1.35) {
    insights.push({
      tone: "info",
      text: `Premium graded comps (${formatPriceCompact(premMed)} median) sit above raw FMV — separate lane from raw/raw+grade targets.`,
    });
  }

  if (totalByLane.auction > 0) {
    insights.push({
      tone: "neutral",
      text: `${totalByLane.auction} auction comp${totalByLane.auction === 1 ? "" : "s"} in session — purple bubbles.`,
    });
  }

  let headline = "Bubble size = how many comps share that price band.";
  if (soldMed != null && askMed != null && premMed != null) {
    headline = `Raw solds ~${formatPriceCompact(soldMed)} · asks ~${formatPriceCompact(askMed)} · premium ~${formatPriceCompact(premMed)}`;
  } else if (soldMed != null && askMed != null) {
    headline = `Solds ~${formatPriceCompact(soldMed)} vs asks ~${formatPriceCompact(askMed)} on a log price axis`;
  } else if (askMed != null) {
    headline = `Listings cluster around ${formatPriceCompact(askMed)} — waiting on sold evidence`;
  }

  return { headline, insights };
}

export function buildMarketPriceBubbles(
  evidence: MarketEvidence[],
  options?: { fmvUsd?: number | null },
): MarketPriceBubbleModel | null {
  const priced = evidence.filter(
    (item) => item.priceUsd != null && Number.isFinite(item.priceUsd) && item.priceUsd > 0,
  );
  if (priced.length === 0) return null;

  const allPrices = priced.map((item) => item.priceUsd as number);
  const fmvUsd =
    options?.fmvUsd != null && Number.isFinite(options.fmvUsd) && options.fmvUsd > 0
      ? options.fmvUsd
      : null;

  const scalePrices = fmvUsd != null ? [...allPrices, fmvUsd] : allPrices;
  const scaleMinUsd = Math.max(1, Math.min(...scalePrices) * 0.88);
  const scaleMaxUsd = Math.max(scaleMinUsd * 1.05, Math.max(...scalePrices) * 1.12);

  const totalByLane: Record<HeatmapLaneId, number> = {
    sold: 0,
    listed: 0,
    auction: 0,
    premium: 0,
  };
  for (const item of priced) {
    const lane = classifyHeatmapLane(item);
    if (lane) totalByLane[lane] += 1;
  }

  const laneBubbles = {} as Record<HeatmapLaneId, PriceBubbleCluster[]>;
  const soldPrices = lanePrices(priced, "sold");
  const listedPrices = lanePrices(priced, "listed");
  const premiumPrices = lanePrices(priced, "premium");

  for (const lane of HEATMAP_LANES) {
    laneBubbles[lane.id] = clusterLanePrices(
      lanePrices(priced, lane.id),
      scaleMinUsd,
      scaleMaxUsd,
      lane.id,
    );
  }

  const { headline, insights } = buildBubbleInsights(
    totalByLane,
    soldPrices,
    listedPrices,
    premiumPrices,
    fmvUsd,
  );

  return {
    scaleMinUsd,
    scaleMaxUsd,
    rangeLabel: `${formatPriceCompact(scaleMinUsd)} – ${formatPriceCompact(scaleMaxUsd)}`,
    fmvUsd,
    fmvXPct: fmvUsd != null ? priceToLogPct(fmvUsd, scaleMinUsd, scaleMaxUsd) : null,
    axisTicks: logSpacedTicks(scaleMinUsd, scaleMaxUsd),
    laneBubbles,
    totalByLane,
    headline,
    insights,
    pricedCount: priced.length,
  };
}

/** @deprecated Grid model — use buildMarketPriceBubbles. */
export type MarketHeatmapModel = MarketPriceBubbleModel;

export function buildMarketHeatmap(
  evidence: MarketEvidence[],
  options?: { fmvUsd?: number | null; binCount?: number },
): MarketPriceBubbleModel | null {
  return buildMarketPriceBubbles(evidence, options);
}
