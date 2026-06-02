import type { ExtractedCard, MarketEvidence } from "@/lib/scan/schemas";
import { classifyCardLane } from "@/lib/scan/lane";
import { filterEvidenceByPrintEdition } from "@/lib/scan/print-edition";

export type GradeBucket =
  | "raw"
  | "psa9"
  | "psa10"
  | "bgs10"
  | "bgsBlackLabel"
  | "cgc10"
  | "cgcPristine10"
  | "tag10"
  | "gradedOther"
  | "unknown";

export type MarketVenueType = "auction" | "buy_now" | "offer" | "unknown";

export type GradeBucketSummary = {
  bucket: GradeBucket;
  label: string;
  soldCount: number;
  activeCount: number;
  referenceCount: number;
  medianSoldUsd: number | null;
  medianActiveUsd: number | null;
  latestSoldUsd: number | null;
  latestSoldAt: string | null;
  lowSoldUsd: number | null;
  highSoldUsd: number | null;
  sources: string[];
};

export type MarketIntelligence = {
  targetBucket: GradeBucket;
  fmvUsd: number | null;
  fmvBasis:
    | "target_sold_median"
    | "target_active_median"
    | "target_reference_median"
    | "nearest_sold_median"
    | "sticker_anchor"
    | null;
  confidence: number;
  confidenceLabel: "high" | "medium" | "low" | "none";
  soldCount: number;
  activeCount: number;
  referenceCount: number;
  auctionCount: number;
  buyNowCount: number;
  buckets: GradeBucketSummary[];
};

const BUCKET_LABELS: Record<GradeBucket, string> = {
  raw: "Raw",
  psa9: "PSA 9",
  psa10: "PSA 10",
  bgs10: "BGS 10",
  bgsBlackLabel: "BGS Black Label",
  cgc10: "CGC 10",
  cgcPristine10: "CGC Pristine 10",
  tag10: "TAG 10",
  gradedOther: "Other graded",
  unknown: "Unknown",
};

const BUCKET_ORDER: GradeBucket[] = [
  "raw",
  "psa9",
  "psa10",
  "bgs10",
  "bgsBlackLabel",
  "cgc10",
  "cgcPristine10",
  "tag10",
  "gradedOther",
  "unknown",
];

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
}

function evidenceText(item: MarketEvidence): string {
  return `${item.slab ?? ""} ${item.title ?? ""}`.toLowerCase();
}

export function gradeBucketLabel(bucket: GradeBucket): string {
  return BUCKET_LABELS[bucket];
}

export function inferEvidenceGradeBucket(item: MarketEvidence): GradeBucket {
  const h = evidenceText(item);
  if (/black\s*label|bgs.*black/.test(h)) return "bgsBlackLabel";
  if (/\btag\b/.test(h) && /\b10\b/.test(h)) return "tag10";
  if (/cgc/.test(h) && /pristine/.test(h) && /\b10\b/.test(h)) return "cgcPristine10";
  if (/cgc/.test(h) && /\b10(?:\.0)?\b/.test(h)) return "cgc10";
  if (/bgs|beckett/.test(h) && /\b10(?:\.0)?\b/.test(h)) return "bgs10";
  if (/psa/.test(h) && /\b10\b|gem\s*mint/.test(h)) return "psa10";
  if (/psa/.test(h) && /\b9\b|mint\s*9/.test(h)) return "psa9";
  if (/raw|ungraded|near\s*mint\s*ungraded/i.test(h)) return "raw";
  if (/psa|bgs|beckett|cgc|tag|sgc|ace|degree|mana/.test(h)) return "gradedOther";
  return "unknown";
}

export function inferCardTargetGradeBucket(card: ExtractedCard): GradeBucket {
  const lane = classifyCardLane(card).lane;
  if (lane !== "graded") return "raw";
  const grader = `${card.grader ?? ""} ${card.grade ?? ""} ${card.labelTitle ?? ""}`.toLowerCase();
  if (/black\s*label/.test(grader)) return "bgsBlackLabel";
  if (/\btag\b/.test(grader) && /\b10\b/.test(grader)) return "tag10";
  if (/cgc/.test(grader) && /pristine/.test(grader) && /\b10\b/.test(grader)) return "cgcPristine10";
  if (/cgc/.test(grader) && /\b10(?:\.0)?\b/.test(grader)) return "cgc10";
  if (/bgs|beckett/.test(grader) && /\b10(?:\.0)?\b/.test(grader)) return "bgs10";
  if (/psa/.test(grader) && /\b10\b|gem\s*mint/.test(grader)) return "psa10";
  if (/psa/.test(grader) && /\b9(?:\.5)?\b/.test(grader)) return "psa9";
  if (/psa/.test(grader) && /\b8(?:\.5)?\b/.test(grader)) return "gradedOther";
  if (/cgc/.test(grader) && /\b9(?:\.5)?\b/.test(grader)) return "gradedOther";
  if (/cgc/.test(grader) && /\b8(?:\.5)?\b/.test(grader)) return "gradedOther";
  if (/bgs|beckett/.test(grader) && /\b9(?:\.5)?\b/.test(grader)) return "gradedOther";
  return "gradedOther";
}

function evidenceMatchesCardGrade(card: ExtractedCard, item: MarketEvidence): boolean {
  const h = evidenceText(item);
  if (/raw|ungraded|nm[-\s]?mt(?!\s*\d)|near\s*mint\s*ungraded/i.test(h)) return false;
  const grader = card.grader?.trim().toLowerCase();
  if (grader) {
    if (grader.includes("psa") && !/psa/.test(h)) return false;
    if (grader.includes("cgc") && !/cgc/.test(h)) return false;
    if ((grader.includes("bgs") || grader.includes("beckett")) && !/bgs|beckett/.test(h)) {
      return false;
    }
  }
  const gradeNum = card.grade?.match(/\d+(?:\.\d+)?/)?.[0];
  if (gradeNum) {
    const re = new RegExp(`\\b${gradeNum.replace(".", "\\.")}\\b`);
    if (!re.test(h) && !/gem\s*mint|pristine|black\s*label/i.test(h)) return false;
  }
  return true;
}

function filterEvidenceForGradedTarget(
  evidence: MarketEvidence[],
  card: ExtractedCard,
  targetBucket: GradeBucket,
): MarketEvidence[] {
  const gradedOnly = evidence.filter((item) => inferEvidenceGradeBucket(item) !== "raw");
  const gradeMatched = gradedOnly.filter((item) => evidenceMatchesCardGrade(card, item));
  const exactBucket = gradeMatched.filter(
    (item) => inferEvidenceGradeBucket(item) === targetBucket,
  );
  if (exactBucket.length >= 2) return exactBucket;
  if (gradeMatched.length >= 2) return gradeMatched;
  if (gradedOnly.length >= 2) return gradedOnly;
  return evidence;
}

export function inferMarketVenueType(item: MarketEvidence): MarketVenueType {
  const h = `${item.title} ${item.source ?? ""}`.toLowerCase();
  if (/auction|bid|bids|hammer|goldin|heritage|pwcc|fanatics collect/.test(h)) return "auction";
  if (/best offer|obo|offer accepted|accepted offer/.test(h)) return "offer";
  if (/buy it now|bin|listed|listing|tcgplayer|cardmarket/.test(h)) return "buy_now";
  return "unknown";
}

function price(item: MarketEvidence): number | null {
  const value = item.priceUsd;
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value < 500_000 ? value : null;
}

function observedTime(item: MarketEvidence): number {
  if (!item.observedAt) return 0;
  const time = new Date(item.observedAt).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function priced(items: MarketEvidence[], kind: MarketEvidence["kind"]): number[] {
  const values = items.filter((item) => item.kind === kind).map(price).filter((value): value is number => value != null);
  if (values.length < 4) return values;
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor((sorted.length - 1) * 0.25)];
  const q3 = sorted[Math.floor((sorted.length - 1) * 0.75)];
  const iqr = q3 - q1;
  const low = Math.max(1, q1 - iqr * 1.5);
  const high = q3 + iqr * 1.5;
  return sorted.filter((value) => value >= low && value <= high);
}

function buildBucketSummary(bucket: GradeBucket, items: MarketEvidence[]): GradeBucketSummary {
  const sold = items.filter((item) => item.kind === "sold");
  const active = items.filter((item) => item.kind === "active");
  const reference = items.filter((item) => item.kind === "reference");
  const soldPrices = priced(items, "sold");
  const latestSold = [...sold]
    .filter((item) => price(item) != null)
    .sort((a, b) => observedTime(b) - observedTime(a))[0];
  const sources = Array.from(
    new Set(items.map((item) => item.source?.trim()).filter((source): source is string => Boolean(source))),
  ).slice(0, 5);

  return {
    bucket,
    label: BUCKET_LABELS[bucket],
    soldCount: sold.length,
    activeCount: active.length,
    referenceCount: reference.length,
    medianSoldUsd: median(soldPrices),
    medianActiveUsd: median(priced(items, "active")),
    latestSoldUsd: latestSold ? price(latestSold) : null,
    latestSoldAt: latestSold?.observedAt ?? null,
    lowSoldUsd: soldPrices.length ? Math.min(...soldPrices) : null,
    highSoldUsd: soldPrices.length ? Math.max(...soldPrices) : null,
    sources,
  };
}

function confidenceFor(summary: GradeBucketSummary | null, totalSources: number, basis: MarketIntelligence["fmvBasis"]): number {
  if (!summary || !basis) return 0;
  let score = 0.15;
  score += Math.min(summary.soldCount, 8) * 0.075;
  score += Math.min(summary.activeCount, 6) * 0.025;
  score += Math.min(totalSources, 4) * 0.05;
  if (basis === "target_sold_median") score += 0.18;
  if (basis === "nearest_sold_median") score += 0.08;
  if (basis === "target_active_median") score -= 0.08;
  if (basis === "sticker_anchor") score = 0.2;
  return Math.max(0, Math.min(0.96, score));
}

function confidenceLabel(confidence: number): MarketIntelligence["confidenceLabel"] {
  if (confidence <= 0) return "none";
  if (confidence >= 0.72) return "high";
  if (confidence >= 0.45) return "medium";
  return "low";
}

export type PrintEditionScopeCard = Pick<ExtractedCard, "printStamps" | "details">;

export function analyzeMarketEvidence(
  evidence: MarketEvidence[],
  options: {
    card?: PrintEditionScopeCard | null;
    gradeCard?: ExtractedCard | null;
    stickerUsd?: number | null;
    targetGradeBucket?: GradeBucket | null;
  } = {},
): MarketIntelligence {
  let scoped =
    options.card != null ? filterEvidenceByPrintEdition(evidence, options.card) : evidence;
  const targetBucketEarly =
    options.targetGradeBucket ??
    (options.gradeCard ? inferCardTargetGradeBucket(options.gradeCard) : "raw");
  if (
    options.gradeCard &&
    classifyCardLane(options.gradeCard).lane === "graded" &&
    targetBucketEarly !== "raw"
  ) {
    scoped = filterEvidenceForGradedTarget(scoped, options.gradeCard, targetBucketEarly);
  }
  const byBucket = new Map<GradeBucket, MarketEvidence[]>();
  for (const bucket of BUCKET_ORDER) byBucket.set(bucket, []);
  for (const item of scoped) {
    byBucket.get(inferEvidenceGradeBucket(item))?.push(item);
  }
  const buckets = BUCKET_ORDER.map((bucket) => buildBucketSummary(bucket, byBucket.get(bucket) ?? []));
  const targetBucket =
    options.targetGradeBucket ??
    (options.gradeCard ? inferCardTargetGradeBucket(options.gradeCard) : "raw");
  const target = buckets.find((bucket) => bucket.bucket === targetBucket) ?? buckets[0];
  const nearestSold =
    target.medianSoldUsd != null
      ? target
      : buckets.find((bucket) => bucket.medianSoldUsd != null && bucket.bucket !== "unknown") ?? null;

  let fmvUsd: number | null = null;
  let fmvBasis: MarketIntelligence["fmvBasis"] = null;
  let basisSummary: GradeBucketSummary | null = target;

  if (target.medianSoldUsd != null) {
    fmvUsd = target.medianSoldUsd;
    fmvBasis = "target_sold_median";
  } else if (target.medianActiveUsd != null) {
    fmvUsd = target.medianActiveUsd;
    fmvBasis = "target_active_median";
  } else if (nearestSold?.medianSoldUsd != null) {
    fmvUsd = nearestSold.medianSoldUsd;
    fmvBasis = "nearest_sold_median";
    basisSummary = nearestSold;
  } else {
    const reference = buckets.find((bucket) => median(priced(byBucket.get(bucket.bucket) ?? [], "reference")) != null);
    const referenceMedian = reference ? median(priced(byBucket.get(reference.bucket) ?? [], "reference")) : null;
    if (referenceMedian != null) {
      fmvUsd = referenceMedian;
      fmvBasis = "target_reference_median";
      basisSummary = reference ?? target;
    } else if (
      typeof options.stickerUsd === "number" &&
      Number.isFinite(options.stickerUsd) &&
      options.stickerUsd >= 1 &&
      options.stickerUsd < 500_000
    ) {
      fmvUsd = options.stickerUsd;
      fmvBasis = "sticker_anchor";
    }
  }

  const allSources = new Set(scoped.map((item) => item.source?.trim()).filter(Boolean));
  const confidence = confidenceFor(basisSummary, allSources.size, fmvBasis);
  const auctionCount = scoped.filter((item) => inferMarketVenueType(item) === "auction").length;
  const buyNowCount = scoped.filter((item) => inferMarketVenueType(item) === "buy_now").length;

  return {
    targetBucket,
    fmvUsd,
    fmvBasis,
    confidence,
    confidenceLabel: confidenceLabel(confidence),
    soldCount: scoped.filter((item) => item.kind === "sold").length,
    activeCount: scoped.filter((item) => item.kind === "active").length,
    referenceCount: scoped.filter((item) => item.kind === "reference").length,
    auctionCount,
    buyNowCount,
    buckets,
  };
}
