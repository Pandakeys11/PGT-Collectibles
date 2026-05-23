import type { ScanSpecimen } from "@/hooks/use-scan-session";
import {
  analyzeMarketEvidence,
  gradeBucketLabel,
  inferEvidenceGradeBucket,
  inferMarketVenueType,
  type GradeBucket,
} from "@/lib/market/market-intelligence";
import { deriveFairValueResult } from "@/lib/market/fair-value";
import {
  GRADE_MATCHERS,
  type GradeBucketId,
} from "@/lib/market/grade-match";
import {
  buildEbayGradeHubs,
  buildEbayHubForCard,
  buildHubUrlMap,
  resolveEvidenceExternalUrl,
  type EbayGradeHub,
  type EbayGradeHubKey,
} from "@/lib/market/sources";
import type { FairValueBasis } from "@/lib/market/fair-value";
import type { MarketEvidence } from "@/lib/scan/schemas";
import {
  evidenceTimeMs,
  sortEvidenceNewestFirst,
} from "@/lib/scan/market-intelligence";

export type GradeHighlightView = {
  bucket: GradeBucketId;
  title: string;
  latestSold: MarketEvidence | null;
  latestListed: MarketEvidence | null;
  fmvUsd: number | null;
  fmvBasis: FairValueBasis | null;
  soldCount: number;
  listedCount: number;
  ebayHub: EbayGradeHub;
};

export type MarketSourceBrand = {
  id: string;
  label: string;
  lane: "sold" | "active";
  url: string;
  accent: string;
  tagline: string;
};

const PREMIUM_GRADES: GradeBucketId[] = ["psa10", "bgsBlackLabel", "cgcPristine10"];

const PREMIUM_TITLES: Record<GradeBucketId, string> = {
  psa10: "PSA 10",
  psa9: "PSA 9",
  bgsBlackLabel: "BGS Black Label",
  cgcPristine10: "CGC Pristine 10",
};

const SOURCE_BRAND: Record<
  string,
  { accent: string; tagline: string }
> = {
  ebay: { accent: "#e53238", tagline: "Search sold & live listings" },
  tcgplayer: { accent: "#0a7ea4", tagline: "TCGPlayer market" },
  cardmarket: { accent: "#012169", tagline: "EU marketplace" },
  pricecharting: { accent: "#f59e0b", tagline: "Price guide" },
  cardladder: { accent: "#8b5cf6", tagline: "Sales index" },
  alt: { accent: "#10b981", tagline: "Alt analytics" },
  goldin: { accent: "#d97706", tagline: "Auction house" },
  fanatics: { accent: "#1d4ed8", tagline: "Fanatics Collect" },
};

function buildHighlight(
  evidence: MarketEvidence[],
  bucket: GradeBucketId,
): GradeHighlightView {
  const matcher = GRADE_MATCHERS[bucket];
  const pool = evidence.filter(matcher);
  const sold = sortEvidenceNewestFirst(pool.filter((i) => i.kind === "sold"));
  const active = sortEvidenceNewestFirst(pool.filter((i) => i.kind === "active"));
  const fmv = deriveFairValueResult(pool);

  return {
    bucket,
    title: PREMIUM_TITLES[bucket],
    latestSold: sold[0] ?? null,
    latestListed: active[0] ?? null,
    fmvUsd: fmv.fairValueUsd,
    fmvBasis: fmv.fairValueBasis,
    soldCount: sold.length,
    listedCount: active.length,
    ebayHub: { sold: "", active: "" },
  };
}

export function buildSpecimenMarketView(specimen: ScanSpecimen | null) {
  if (!specimen) {
    return null;
  }

  const certRows = specimen.context.certMarketEvidence ?? [];
  const baseEvidence = specimen.context.marketEvidence ?? [];
  const seen = new Set<string>();
  const evidence = [...certRows, ...baseEvidence].filter((it) => {
    const key = `${it.kind}|${it.url ?? ""}|${it.title}|${it.priceUsd ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const hubLinks = specimen.context.marketSourceLinks ?? [];
  const hubMap = buildHubUrlMap(hubLinks);
  const ebayGradeHubs = buildEbayGradeHubs(specimen.card);
  const intel = analyzeMarketEvidence(evidence, {
    card: specimen.card,
    gradeCard: specimen.card,
    stickerUsd: specimen.context.askingUsd,
  });

  const sold = sortEvidenceNewestFirst(evidence.filter((i) => i.kind === "sold"));
  const active = sortEvidenceNewestFirst(evidence.filter((i) => i.kind === "active"));
  const reference = sortEvidenceNewestFirst(
    evidence.filter((i) => i.kind === "reference"),
  );

  const auctions = sortEvidenceNewestFirst(
    evidence.filter(
      (i) =>
        inferMarketVenueType(i) === "auction" ||
        /auction|pwcc|goldin|heritage|fanatics collect/i.test(
          `${i.title} ${i.source ?? ""}`,
        ),
    ),
  );

  const premiumGrades = PREMIUM_GRADES.map((bucket) => {
    const row = buildHighlight(evidence, bucket);
    return {
      ...row,
      ebayHub: ebayGradeHubs[bucket],
    };
  });

  const sourceAds: MarketSourceBrand[] = hubLinks.map((link) => {
    const brand = SOURCE_BRAND[link.source] ?? {
      accent: "#64748b",
      tagline: "Open market search",
    };
    return {
      id: `${link.source}-${link.lane}`,
      label: link.label.replace(/\s+(sold|listed|active)$/i, "").trim() || link.label,
      lane: link.lane,
      url: link.url,
      accent: brand.accent,
      tagline: brand.tagline,
    };
  });

  return {
    intel,
    hubMap,
    ebayGradeHubs,
    sold,
    active,
    reference,
    auctions,
    premiumGrades,
    sourceAds,
    targetBucket: intel.targetBucket,
    targetLabel: gradeBucketLabel(intel.targetBucket),
  };
}

export function resolveListingUrl(
  item: MarketEvidence,
  hubMap: ReturnType<typeof buildHubUrlMap>,
  ebayGradeHubs: ReturnType<typeof buildEbayGradeHubs>,
  card?: import("@/lib/scan/schemas").ExtractedCard | null,
): string | null {
  const cardHub = card ? buildEbayHubForCard(card) : undefined;
  const slab = item.slab ?? "";
  let gradeKey: EbayGradeHubKey = "raw";
  if (/psa\s*10/i.test(slab)) gradeKey = "psa10";
  else if (/psa\s*9/i.test(slab)) gradeKey = "psa9";
  else if (/black\s*label|bgs.*black/i.test(slab)) gradeKey = "bgsBlackLabel";
  else if (/pristine|cgc/i.test(slab) && /10/i.test(slab)) gradeKey = "cgcPristine10";

  return (
    resolveEvidenceExternalUrl(item, hubMap, {
      ebayCardHub: item.kind === "sold" ? cardHub : undefined,
      ebayGradeHub: item.kind === "sold" ? undefined : ebayGradeHubs[gradeKey],
    }) ?? item.url
  );
}

export function formatMarketUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `$${Math.round(value).toLocaleString()}`;
}

export function formatMarketDate(value: string | null | undefined): string {
  if (!value) return "Date n/a";
  const t = new Date(value);
  return Number.isNaN(t.getTime()) ? value : t.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function gradeBadgeForItem(item: MarketEvidence): string {
  const bucket = item.gradeBucket ?? inferEvidenceGradeBucket(item);
  return gradeBucketLabel(bucket as GradeBucket);
}

export function isRecentSale(item: MarketEvidence): boolean {
  const ms = evidenceTimeMs(item);
  if (!ms) return false;
  return Date.now() - ms < 120 * 24 * 60 * 60 * 1000;
}
