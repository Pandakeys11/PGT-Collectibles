import type { ScanSpecimen } from "@/hooks/use-scan-session";
import type { MarketEvidence } from "@/lib/scan/schemas";

export type MarketLaneFilter = "all" | "raw" | "graded";
export type RawConditionFilter = "all" | "nm" | "lp" | "mp" | "hp" | "dmg";

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? null;
  const a = sorted[mid - 1];
  const b = sorted[mid];
  return a == null || b == null ? null : (a + b) / 2;
}

export function formatMarketDate(value: string | null | undefined): string {
  if (!value) return "No date";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

export function evidenceTimeMs(item: MarketEvidence): number {
  if (!item.observedAt) return 0;
  const t = new Date(item.observedAt).getTime();
  return Number.isNaN(t) ? 0 : t;
}

export function sortEvidenceNewestFirst(items: MarketEvidence[]): MarketEvidence[] {
  return [...items].sort((a, b) => evidenceTimeMs(b) - evidenceTimeMs(a));
}

function haystack(item: MarketEvidence): string {
  return `${item.slab ?? ""} ${item.title}`.toLowerCase();
}

export function isGradedEvidence(item: MarketEvidence): boolean {
  const h = haystack(item);
  return /psa|cgc|bgs|sgc|graded|slab|gem\s*mint|\b10\b|\b9\.5\b/i.test(h);
}

export function isRawEvidence(item: MarketEvidence): boolean {
  if (isGradedEvidence(item)) return false;
  const h = haystack(item);
  return /raw|ungraded|nm\b|near\s*mint|lp\b|lightly|mp\b|moderately|hp\b|heavily|dmg|damaged/i.test(h) || item.slab == null;
}

export function matchRawCondition(item: MarketEvidence, filter: RawConditionFilter): boolean {
  if (filter === "all") return true;
  const h = haystack(item);
  switch (filter) {
    case "nm":
      return /near\s*mint|\bnm\b|mint/i.test(h);
    case "lp":
      return /lightly\s*played|\blp\b/i.test(h);
    case "mp":
      return /moderately\s*played|\bmp\b/i.test(h);
    case "hp":
      return /heavily\s*played|\bhp\b/i.test(h);
    case "dmg":
      return /damaged|\bdmg\b|poor/i.test(h);
    default:
      return true;
  }
}

export type GradedGradeFilter =
  | "all"
  | "psa10"
  | "psa9"
  | "bgs10"
  | "bgsBlackLabel"
  | "cgc10"
  | "cgcPristine10"
  | "other";

export function matchGradedGrade(item: MarketEvidence, filter: GradedGradeFilter): boolean {
  if (filter === "all") return true;
  const h = haystack(item);
  switch (filter) {
    case "psa10":
      return /psa\s*10/i.test(h) && !/black\s*label/i.test(h);
    case "psa9":
      return /psa\s*9/i.test(h);
    case "bgsBlackLabel":
      return /black\s*label|bgs\s*black/i.test(h);
    case "bgs10":
      return /bgs|beckett/i.test(h) && /\b10\b/.test(h) && !/black\s*label/i.test(h);
    case "cgcPristine10":
      return /cgc/i.test(h) && (/pristine/i.test(h) || /cgc\s*10/i.test(h)) && /\b10\b/.test(h);
    case "cgc10":
      return /cgc/i.test(h) && /\b10\b/.test(h) && !/pristine/i.test(h);
    default:
      return isGradedEvidence(item);
  }
}

export function filterMarketEvidence(
  items: MarketEvidence[],
  options: {
    lane: MarketLaneFilter;
    rawCondition: RawConditionFilter;
    gradedGrade: GradedGradeFilter;
    kind?: "sold" | "active" | "reference" | "all";
  },
): MarketEvidence[] {
  return items.filter((item) => {
    if (options.kind && options.kind !== "all" && item.kind !== options.kind) return false;
    if (options.lane === "raw" && !isRawEvidence(item)) return false;
    if (options.lane === "graded" && !isGradedEvidence(item)) return false;
    if (options.lane === "raw" && !matchRawCondition(item, options.rawCondition)) return false;
    if (options.lane === "graded" && !matchGradedGrade(item, options.gradedGrade)) return false;
    return true;
  });
}

export function marketStats(specimen: ScanSpecimen | null) {
  const evidence = specimen?.context.marketEvidence ?? [];
  const priced = evidence.filter((item) => item.priceUsd != null && Number.isFinite(item.priceUsd));
  const sold = evidence.filter((item) => item.kind === "sold");
  const active = evidence.filter((item) => item.kind === "active");
  const reference = evidence.filter((item) => item.kind === "reference");
  const auctionLike = active.filter((item) =>
    /auction|ending|bid|pwcc|goldin|heritage/i.test(haystack(item)),
  );
  const soldPrices = sold
    .map((item) => item.priceUsd)
    .filter((value): value is number => value != null && Number.isFinite(value));
  const allPrices = priced.map((item) => item.priceUsd).filter((value): value is number => value != null);
  const newest = sortEvidenceNewestFirst(evidence)[0];

  return {
    evidence,
    priced,
    sold,
    active,
    reference,
    auctionLike,
    allPrices,
    soldMedian: median(soldPrices),
    priceMedian: median(allPrices),
    priceLow: allPrices.length ? Math.min(...allPrices) : null,
    priceHigh: allPrices.length ? Math.max(...allPrices) : null,
    newest,
  };
}

export function marketDecision(
  specimen: ScanSpecimen | null,
  stats: ReturnType<typeof marketStats>,
) {
  if (!specimen) {
    return {
      label: "Awaiting card",
      detail: "Select a detected card to load market intelligence.",
      tone: "slate" as const,
    };
  }
  if (specimen.context.verificationStatus === "failed") {
    return {
      label: "Verify first",
      detail: "Identity has conflicts. Confirm catalog match before pricing.",
      tone: "rose" as const,
    };
  }
  if (stats.sold.length >= 2 && specimen.context.fairValueUsd != null) {
    return {
      label: "Ready to price",
      detail: "Sold comps and fair value are available for a confident decision.",
      tone: "emerald" as const,
    };
  }
  if (stats.active.length > 0 || stats.reference.length > 0) {
    return {
      label: "Price with caution",
      detail: "Listings exist, but sold evidence is thin.",
      tone: "amber" as const,
    };
  }
  return {
    label: "Research needed",
    detail: "Open sources or resync to gather more comps.",
    tone: "cyan" as const,
  };
}

export type PriceChartPoint = {
  x: number;
  y: number;
  price: number;
  kind: MarketEvidence["kind"];
  label: string;
  title?: string;
  source?: string | null;
  slab?: string | null;
};

export function buildPriceChartPoints(
  specimen: ScanSpecimen | null,
  evidenceOverride?: MarketEvidence[],
): PriceChartPoint[] {
  const evidence = (evidenceOverride ?? specimen?.context.marketEvidence ?? [])
    .filter((item) => item.priceUsd != null && Number.isFinite(item.priceUsd))
    .sort((a, b) => evidenceTimeMs(a) - evidenceTimeMs(b))
    .slice(-12);
  const prices = evidence.map((item) => item.priceUsd).filter((value): value is number => value != null);
  const low = prices.length ? Math.min(...prices) : 0;
  const high = prices.length ? Math.max(...prices) : 0;
  const spread = Math.max(1, high - low);
  return evidence.map((item, index) => {
    const x = evidence.length <= 1 ? 50 : (index / (evidence.length - 1)) * 100;
    const price = item.priceUsd ?? low;
    const y = 90 - ((price - low) / spread) * 70;
    return {
      x,
      y,
      price,
      kind: item.kind,
      label: formatMarketDate(item.observedAt),
      title: item.title,
      source: item.source,
      slab: item.slab,
    };
  });
}

export function priceChangeVsFmv(
  specimen: ScanSpecimen | null,
  fmvOverride?: number | null,
): {
  deltaUsd: number | null;
  deltaPct: number | null;
  label: string;
} {
  const fmv = fmvOverride ?? specimen?.context.fairValueUsd ?? null;
  const stats = marketStats(specimen);
  const anchor =
    stats.soldMedian ??
    (stats.sold[0]?.priceUsd != null ? stats.sold[0].priceUsd : null) ??
    stats.priceMedian;
  if (fmv == null || anchor == null) {
    return { deltaUsd: null, deltaPct: null, label: "—" };
  }
  const deltaUsd = Math.round(anchor - fmv);
  const deltaPct = fmv !== 0 ? Math.round(((anchor - fmv) / fmv) * 1000) / 10 : null;
  const sign = deltaUsd >= 0 ? "+" : "";
  return {
    deltaUsd,
    deltaPct,
    label: `${sign}$${Math.abs(deltaUsd).toLocaleString()}${deltaPct != null ? ` (${sign}${deltaPct}%)` : ""}`,
  };
}
