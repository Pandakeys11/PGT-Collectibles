import { median, deriveFairValueResult, type FairValueBasis } from "@/lib/market/fair-value";
import {
  matchesBgsBlackLabel,
  matchesCgcPristine10,
  matchesPsa10,
  matchesPsa9,
} from "@/lib/market/grade-match";
import type { TcgCardDetail } from "@/lib/pokedex/tcg-api-types";
import type { ExtractedCard, MarketEvidence } from "@/lib/scan/schemas";

export type TcgVariantRow = {
  variant: string;
  market: number | null;
  low: number | null;
  mid: number | null;
  high: number | null;
};

export type GradeHighlight = {
  latestSold: MarketEvidence | null;
  latestListed: MarketEvidence | null;
  fmvUsd: number | null;
  fmvBasis: FairValueBasis | null;
};

export type GradeComparisonRow = {
  fmvUsd: number | null;
  basis: FairValueBasis | null;
};

export type GradeComparison = {
  raw: GradeComparisonRow;
  psa9: GradeComparisonRow;
  psa10: GradeComparisonRow;
  deltaRawToPsa9: number | null;
  deltaRawToPsa10: number | null;
  deltaPsa9ToPsa10: number | null;
};

export type CatalogMarketSnapshot = {
  tcgVariants: TcgVariantRow[];
  tcgPlayerUpdatedAt: string | null;
  tcgPlayerUrl: string | null;
  cardMarket: NonNullable<TcgCardDetail["cardmarket"]>["prices"] | null;
  cardMarketUpdatedAt: string | null;
  cardMarketUrl: string | null;
  fairValueUsd: number | null;
  fairValueBasis: FairValueBasis | null;
  gradeComparison: GradeComparison;
  rawHighlight: GradeHighlight;
  highlights: {
    psa10: GradeHighlight;
    bgsBlackLabel: GradeHighlight;
    cgcPristine10: GradeHighlight;
  };
  recentSales: MarketEvidence[];
  recentListings: MarketEvidence[];
  marketEvidence: MarketEvidence[];
};

function evidenceTimeMs(item: MarketEvidence): number {
  if (!item.observedAt) return 0;
  const t = new Date(item.observedAt).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function sortNewest(items: MarketEvidence[]): MarketEvidence[] {
  return [...items].sort((a, b) => evidenceTimeMs(b) - evidenceTimeMs(a));
}

function withPrice(item: MarketEvidence): boolean {
  return typeof item.priceUsd === "number" && Number.isFinite(item.priceUsd);
}

function excludeGraded(item: MarketEvidence): boolean {
  return !matchesPsa10(item) && !matchesPsa9(item) && !matchesBgsBlackLabel(item) && !matchesCgcPristine10(item);
}

function medianSold(evidence: MarketEvidence[], include: (item: MarketEvidence) => boolean): number | null {
  const prices = evidence
    .filter((item) => item.kind === "sold" && withPrice(item) && include(item))
    .map((item) => item.priceUsd as number);
  return median(prices);
}

function medianActive(evidence: MarketEvidence[], include: (item: MarketEvidence) => boolean): number | null {
  const prices = evidence
    .filter((item) => item.kind === "active" && withPrice(item) && include(item))
    .map((item) => item.priceUsd as number);
  return median(prices);
}

function deriveRow(
  evidence: MarketEvidence[],
  include: (item: MarketEvidence) => boolean,
  tcgFallback: number | null,
): GradeComparisonRow {
  const sold = medianSold(evidence, include);
  if (sold != null) return { fmvUsd: Math.round(sold), basis: "sold_median" };
  const active = medianActive(evidence, include);
  if (active != null) return { fmvUsd: Math.round(active), basis: "active_median" };
  if (tcgFallback != null && Number.isFinite(tcgFallback) && tcgFallback >= 1) {
    return { fmvUsd: Math.round(tcgFallback), basis: "reference_median" };
  }
  return { fmvUsd: null, basis: null };
}

function isUsdCatalog(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 1;
}

/**
 * Headline TCGPlayer "market" from the Pokémon TCG API embed — aligns with the product page
 * when the API carries the same variant rows (avoids eBay ask medians diluting raw FMV).
 */
export function primaryTcgPlayerCatalogUsd(card: TcgCardDetail): number | null {
  const prices = card.tcgplayer?.prices;
  if (!prices || typeof prices !== "object") return null;

  const rarity = `${card.rarity ?? ""} ${(card.subtypes ?? []).join(" ")}`.toLowerCase();
  const finish = card.catalogFinish;

  type Entry = { variant: string; market: number | null; mid: number | null };
  const entries: Entry[] = Object.entries(prices).map(([variant, p]) => ({
    variant: variant.toLowerCase(),
    market: isUsdCatalog(p?.market) ? p.market : null,
    mid: isUsdCatalog(p?.mid) ? p.mid : null,
  }));

  const maxMarket = (pool: Entry[]): number | null => {
    const m = pool.map((e) => e.market).filter((n): n is number => n != null);
    return m.length ? Math.max(...m) : null;
  };

  let pool = entries;
  if (finish === "reverse_holo") {
    const rh = entries.filter((e) => /reverse/.test(e.variant));
    if (rh.length) pool = rh;
  } else if (/illustration|secret|rainbow|gold|hyper|radiant/i.test(rarity)) {
    const premium = entries.filter((e) => /holo|reverse|full|poke|ball|amazing/i.test(e.variant));
    if (premium.length) pool = premium;
  }

  let out = maxMarket(pool);
  if (out == null) out = maxMarket(entries);
  if (out == null) {
    const mids = entries.map((e) => e.mid).filter((n): n is number => n != null);
    out = mids.length ? Math.max(...mids) : null;
  }
  return out;
}

/** Prefer embedded TCGPlayer catalog market for raw headline FMV when present. */
function deriveRawCatalogRow(evidence: MarketEvidence[], tcgCatalog: number | null): GradeComparisonRow {
  if (typeof tcgCatalog === "number" && Number.isFinite(tcgCatalog) && tcgCatalog >= 1) {
    return { fmvUsd: Math.round(tcgCatalog), basis: "tcg_catalog" };
  }
  return deriveRow(evidence, excludeGraded, null);
}

function delta(a: number | null, b: number | null): number | null {
  if (a == null || b == null) return null;
  return Math.round(b - a);
}

function pickLatestSold(
  evidence: MarketEvidence[],
  include: (item: MarketEvidence) => boolean,
): MarketEvidence | null {
  const sold = sortNewest(evidence).find(
    (item) => item.kind === "sold" && withPrice(item) && include(item),
  );
  if (sold) return sold;
  return (
    sortNewest(evidence).find(
      (item) =>
        withPrice(item) &&
        include(item) &&
        (item.kind === "reference" || item.kind === "sold") &&
        /sold|avg sell|completed|hammer/i.test(`${item.title} ${item.source ?? ""}`),
    ) ?? null
  );
}

function pickLatestListed(
  evidence: MarketEvidence[],
  include: (item: MarketEvidence) => boolean,
): MarketEvidence | null {
  const active = sortNewest(evidence).find(
    (item) => item.kind === "active" && include(item) && (withPrice(item) || item.url),
  );
  if (active) return active;
  return (
    sortNewest(evidence).find(
      (item) =>
        withPrice(item) &&
        include(item) &&
        (item.kind === "active" || item.kind === "reference") &&
        /market|low|ask|listing|for sale|trend|tcgplayer/i.test(`${item.title} ${item.source ?? ""}`),
    ) ?? null
  );
}

function buildHighlight(
  evidence: MarketEvidence[],
  include: (item: MarketEvidence) => boolean,
  tcgCatalog: number | null = null,
): GradeHighlight {
  const sold = pickLatestSold(evidence, include);
  const listed = pickLatestListed(evidence, include);
  const fmvSold = medianSold(evidence, (item) => include(item));
  const fmvActive = medianActive(evidence, (item) => include(item));
  const useTcg =
    typeof tcgCatalog === "number" && Number.isFinite(tcgCatalog) && tcgCatalog >= 1;
  const fmvUsd = useTcg ? tcgCatalog : fmvSold ?? fmvActive;
  const fmvBasis: FairValueBasis | null = useTcg
    ? "tcg_catalog"
    : fmvSold != null
      ? "sold_median"
      : fmvActive != null
        ? "active_median"
        : null;
  return {
    latestSold: sold,
    latestListed: listed,
    fmvUsd: fmvUsd != null ? Math.round(fmvUsd) : null,
    fmvBasis,
  };
}

export function tcgDetailToExtracted(card: TcgCardDetail): ExtractedCard {
  return {
    name: card.name,
    set: card.set?.name,
    number: card.number,
    rarity: card.rarity,
    year: card.set?.releaseDate?.slice(0, 4),
  };
}

export function tcgVariantsFromCard(card: TcgCardDetail): TcgVariantRow[] {
  if (!card.tcgplayer?.prices) return [];
  return Object.entries(card.tcgplayer.prices).map(([variant, p]) => ({
    variant,
    market: p?.market ?? null,
    low: p?.low ?? null,
    mid: p?.mid ?? null,
    high: p?.high ?? null,
  }));
}

export function buildCatalogMarketSnapshot(
  card: TcgCardDetail,
  marketEvidence: MarketEvidence[],
): CatalogMarketSnapshot {
  const tcgRaw = primaryTcgPlayerCatalogUsd(card);
  const raw = deriveRawCatalogRow(marketEvidence, tcgRaw);
  const psa9 = deriveRow(marketEvidence, matchesPsa9, null);
  const psa10 = deriveRow(marketEvidence, matchesPsa10, null);

  const gradeComparison: GradeComparison = {
    raw,
    psa9,
    psa10,
    deltaRawToPsa9: delta(raw.fmvUsd, psa9.fmvUsd),
    deltaRawToPsa10: delta(raw.fmvUsd, psa10.fmvUsd),
    deltaPsa9ToPsa10: delta(psa9.fmvUsd, psa10.fmvUsd),
  };

  const { fairValueUsd, fairValueBasis } = deriveFairValueResult(
    marketEvidence.filter(excludeGraded),
    {},
  );
  const overallFmv = raw.fmvUsd ?? fairValueUsd;
  const overallBasis = raw.basis ?? fairValueBasis;

  const recentSales = sortNewest(marketEvidence)
    .filter((item) => item.kind === "sold" && withPrice(item))
    .slice(0, 10);

  const recentListings = sortNewest(marketEvidence)
    .filter((item) => item.kind === "active" && withPrice(item))
    .slice(0, 10);

  return {
    tcgVariants: tcgVariantsFromCard(card),
    tcgPlayerUpdatedAt: card.tcgplayer?.updatedAt ?? null,
    tcgPlayerUrl: card.tcgplayer?.url ?? null,
    cardMarket: card.cardmarket?.prices ?? null,
    cardMarketUpdatedAt: card.cardmarket?.updatedAt ?? null,
    cardMarketUrl: card.cardmarket?.url ?? null,
    fairValueUsd: overallFmv,
    fairValueBasis: overallBasis,
    gradeComparison,
    rawHighlight: buildHighlight(marketEvidence, excludeGraded, tcgRaw),
    highlights: {
      psa10: buildHighlight(marketEvidence, matchesPsa10),
      bgsBlackLabel: buildHighlight(marketEvidence, matchesBgsBlackLabel),
      cgcPristine10: buildHighlight(marketEvidence, matchesCgcPristine10),
    },
    recentSales,
    recentListings,
    marketEvidence: marketEvidence.slice(0, 48),
  };
}
