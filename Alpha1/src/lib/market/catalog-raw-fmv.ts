import { cardMarketUsdFromSnapshot } from "@/lib/market/cardmarket-eur";
import type { CatalogPriceSnapshot } from "@/lib/market/pokemon-catalog";
import { parseCatalogPriceSnapshot } from "@/lib/market/catalog-reference-evidence";
import { bestCatalogUsd } from "@/lib/market/catalog-price-utils";
import type { FairValueBasis } from "@/lib/market/fair-value";
import { median } from "@/lib/market/fair-value";
import {
  filterMarketEvidenceForCardIdentity,
  getCardNumberEvidence,
} from "@/lib/market/market-evidence-identity";
import {
  evidenceHaystack,
  matchesBgsBlackLabel,
  matchesCgcPristine10,
  matchesPsa10,
  matchesPsa9,
} from "@/lib/market/grade-match";
import { inferEvidenceGradeBucket, type GradeBucket } from "@/lib/market/market-intelligence";
import type { ExtractedCard, MarketEvidence } from "@/lib/scan/schemas";

// PriceCharting uses "Gem Mint", "Pristine", etc. for *ungraded* condition bands.
// We only want to exclude true slabbed/graded-company comps.
const RAW_PRICECHARTING_TITLE =
  /loose|ungraded|raw|nm\b|near\s*mint|non[-\s]?graded|unslabbed|gem\s*mint|pristine/i;

// Graded = PSA/BGS/CGC/SGC/TAG (company + grade tier) OR BGS Black Label.
const GRADED_TITLE_HINT =
  /\b(psa|bgs|cgc|sgc|tag|ace|beckett)\s*(?:10|9\.5|9|8|7)\b|\bblack\s*label\b/i;

const RAW_TITLE_HINT = /\b(raw|ungraded|unslabbed|near\s*mint(?!\s*\d))\b/i;

export type CatalogRawFmvBasis =
  | "tcg_player"
  | "pricecharting"
  | "sold_median"
  | "active_median"
  | "reference_median";

export type CatalogRawFmv = {
  usd: number | null;
  basis: CatalogRawFmvBasis | null;
  tcgPlayerUsd: number | null;
  priceChartingUsd: number | null;
  sourceLabel: string;
};

export type CatalogRawFmvIdentity = {
  name?: string | null;
  number?: string | null;
  set?: string | null;
};

function isUsd(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0.5;
}

/** True when a comp row is graded/slab — must not feed Raw FMV. */
export function isGradedMarketEvidence(item: MarketEvidence): boolean {
  if (matchesPsa10(item) || matchesPsa9(item) || matchesBgsBlackLabel(item) || matchesCgcPristine10(item)) {
    return true;
  }
  const h = evidenceHaystack(item);
  if (GRADED_TITLE_HINT.test(h)) return true;
  if (/\btag\b/.test(h) && /\b10\b/.test(h) && !RAW_TITLE_HINT.test(h)) return true;
  if (/pricecharting/i.test(item.source ?? "") && !RAW_PRICECHARTING_TITLE.test(h)) {
    return true;
  }
  if (item.gradeBucket != null && item.gradeBucket !== "raw" && item.gradeBucket !== "unknown") {
    return true;
  }
  return false;
}

/** Resolve display lane for a comp row (title beats stale persisted `raw` buckets). */
export function resolveEvidenceGradeBucket(item: MarketEvidence): GradeBucket {
  if (isGradedMarketEvidence(item)) {
    return inferEvidenceGradeBucket({ ...item, gradeBucket: undefined });
  }
  if (item.gradeBucket === "raw" || RAW_TITLE_HINT.test(evidenceHaystack(item))) {
    return "raw";
  }
  const inferred = inferEvidenceGradeBucket(item);
  return inferred === "unknown" ? "raw" : inferred;
}

function isEbayEvidence(item: MarketEvidence): boolean {
  const blob = `${item.source ?? ""} ${item.url ?? ""}`.toLowerCase();
  return blob.includes("ebay");
}

function excludeGraded(item: MarketEvidence): boolean {
  return !isGradedMarketEvidence(item);
}

function toExtractedCard(identity?: CatalogRawFmvIdentity | null): ExtractedCard | null {
  if (!identity) return null;
  const name = identity.name?.trim();
  if (!name) return null;
  return {
    name,
    set: identity.set ?? undefined,
    number: identity.number ?? undefined,
  };
}

/** Sold/active/reference rows eligible for ungraded FMV (identity + grade filtered). */
export function filterMarketEvidenceForRawLane(
  evidence: MarketEvidence[],
  identity?: CatalogRawFmvIdentity | null,
): MarketEvidence[] {
  const raw = evidence.filter(excludeGraded);
  const card = toExtractedCard(identity);
  if (!card) return raw;
  return filterMarketEvidenceForCardIdentity(raw, card);
}

function filterRawEvidence(
  evidence: MarketEvidence[],
  identity?: CatalogRawFmvIdentity | null,
): MarketEvidence[] {
  return filterMarketEvidenceForRawLane(evidence, identity);
}

function evidenceMatchesCardNumber(
  item: MarketEvidence,
  cardNumber: string | null | undefined,
): boolean {
  if (!cardNumber?.trim()) return true;
  const ev = getCardNumberEvidence(`${item.title} ${item.slab ?? ""}`, cardNumber);
  return ev.level !== "conflict";
}

/** Best TCGPlayer market for a catalog price snapshot (finish / rarity aware). */
export function primaryTcgPlayerFromSnapshot(
  prices: CatalogPriceSnapshot | null | undefined,
  options?: { catalogFinish?: "reverse_holo"; rarity?: string | null },
): number | null {
  if (!prices?.tcgPlayerPrices.length) return null;

  const rarity = `${options?.rarity ?? ""}`.toLowerCase();
  const finish = options?.catalogFinish;

  type Row = { variant: string; market: number | null; mid: number | null };
  const entries: Row[] = prices.tcgPlayerPrices.map((r) => ({
    variant: r.variant.toLowerCase(),
    market: isUsd(r.market) ? r.market : null,
    mid: isUsd(r.mid) ? r.mid : null,
  }));

  const medianMarket = (pool: Row[]): number | null => {
    const m = pool.map((e) => e.market).filter((n): n is number => n != null);
    const med = median(m);
    return med != null ? Math.round(med) : null;
  };

  let pool = entries;
  if (finish === "reverse_holo") {
    const rh = entries.filter((e) => /reverse/.test(e.variant));
    if (rh.length) pool = rh;
  } else if (/illustration|secret|rainbow|gold|hyper|radiant|mega|special/i.test(rarity)) {
    const premium = entries.filter((e) =>
      /holo|reverse|full|poke|ball|amazing|illustration|special|master/i.test(e.variant),
    );
    if (premium.length) pool = premium;
  }

  let out = medianMarket(pool);
  if (out == null) out = medianMarket(entries);
  if (out == null) {
    const mids = entries.map((e) => e.mid).filter((n): n is number => n != null);
    const med = median(mids);
    out = med != null ? Math.round(med) : null;
  }
  return out;
}

export function priceChartingUsdFromSnapshot(
  prices: CatalogPriceSnapshot | null | undefined,
): number | null {
  const n = prices?.priceChartingLooseUsd;
  return isUsd(n) ? Math.round(n) : null;
}

/** Cardmarket trend / avg (EUR→USD) when TCGPlayer has no US market row. */
export function primaryCardMarketFromSnapshot(
  prices: CatalogPriceSnapshot | null | undefined,
): number | null {
  return cardMarketUsdFromSnapshot(prices?.cardMarket);
}

export function priceChartingUsdFromEvidence(evidence: MarketEvidence[]): number | null {
  const rows = evidence.filter(
    (e) =>
      e.source === "PriceCharting" &&
      typeof e.priceUsd === "number" &&
      !isGradedMarketEvidence(e) &&
      RAW_PRICECHARTING_TITLE.test(e.title),
  );
  if (!rows.length) return null;
  const med = median(rows.map((r) => r.priceUsd as number));
  return med != null ? Math.round(med) : null;
}

function medianActiveRaw(
  evidence: MarketEvidence[],
  cardNumber?: string | null,
): number | null {
  const prices = evidence
    .filter(
      (e) =>
        e.kind === "active" &&
        typeof e.priceUsd === "number" &&
        evidenceMatchesCardNumber(e, cardNumber),
    )
    .map((e) => e.priceUsd as number);
  if (prices.length === 0) return null;
  const med = median(prices);
  return med != null ? Math.round(med) : null;
}

function medianSoldRaw(
  evidence: MarketEvidence[],
  cardNumber?: string | null,
): number | null {
  const prices = evidence
    .filter(
      (e) =>
        e.kind === "sold" &&
        typeof e.priceUsd === "number" &&
        evidenceMatchesCardNumber(e, cardNumber),
    )
    .map((e) => e.priceUsd as number);
  if (prices.length === 0) return null;
  const med = median(prices);
  const minCount = prices.length >= 3 ? 3 : 1;
  return med != null && prices.length >= minCount ? Math.round(med) : null;
}

/** eBay-only raw sold + active average (ungraded lane). */
function ebayRawFmvUsd(
  rawLaneEvidence: MarketEvidence[],
  cardNumber?: string | null,
): { usd: number; basis: CatalogRawFmvBasis; sourceLabel: string } | null {
  const ebay = rawLaneEvidence.filter(isEbayEvidence);
  if (!ebay.length) return null;

  const soldUsd = medianSoldRaw(ebay, cardNumber);
  const activeUsd = medianActiveRaw(ebay, cardNumber);

  if (soldUsd != null && activeUsd != null) {
    return {
      usd: Math.round((soldUsd + activeUsd) / 2),
      basis: "sold_median",
      sourceLabel: "eBay raw sold · listed avg",
    };
  }
  if (soldUsd != null) {
    return { usd: soldUsd, basis: "sold_median", sourceLabel: "eBay raw sold" };
  }
  if (activeUsd != null) {
    return { usd: activeUsd, basis: "active_median", sourceLabel: "eBay raw listed" };
  }
  return null;
}

/** Reject PriceCharting when identity-matched listings disagree sharply (wrong SKU). */
function priceChartingTrusted(
  pcUsd: number,
  activeUsd: number | null,
  soldUsd: number | null,
): boolean {
  const anchors = [activeUsd, soldUsd].filter((n): n is number => n != null && n >= 1);
  if (!anchors.length) return true;
  const anchor = median(anchors) ?? anchors[0];
  if (anchor == null) return true;
  const ratio = pcUsd / anchor;
  return ratio >= 0.55 && ratio <= 1.85;
}

/**
 * Headline RAW FMV for master catalog display.
 * TCGPlayer → eBay raw sold + listed average → Cardmarket → PriceCharting loose only.
 */
export function resolveCatalogRawFmv(args: {
  prices?: CatalogPriceSnapshot | null;
  marketEvidence?: MarketEvidence[];
  catalogFinish?: "reverse_holo";
  rarity?: string | null;
  identity?: CatalogRawFmvIdentity | null;
}): CatalogRawFmv {
  const filtered = filterRawEvidence(args.marketEvidence ?? [], args.identity);
  const cardNumber = args.identity?.number ?? null;

  const tcgPlayerUsd = primaryTcgPlayerFromSnapshot(args.prices, {
    catalogFinish: args.catalogFinish,
    rarity: args.rarity,
  });
  const ebayRaw = ebayRawFmvUsd(filtered, cardNumber);
  let priceChartingUsd =
    priceChartingUsdFromSnapshot(args.prices) ?? priceChartingUsdFromEvidence(filtered);
  const ebaySoldUsd = ebayRaw?.basis === "sold_median" ? ebayRaw.usd : null;
  const ebayActiveUsd = ebayRaw?.basis === "active_median" ? ebayRaw.usd : null;
  if (
    priceChartingUsd != null &&
    !priceChartingTrusted(priceChartingUsd, ebayActiveUsd, ebaySoldUsd)
  ) {
    priceChartingUsd = null;
  }
  if (
    priceChartingUsd != null &&
    tcgPlayerUsd != null &&
    priceChartingUsd > tcgPlayerUsd * 2.25
  ) {
    priceChartingUsd = null;
  }

  if (tcgPlayerUsd != null) {
    const sourceLabel = priceChartingUsd != null ? "TCGPlayer · PriceCharting" : "TCGPlayer";
    return {
      usd: Math.round(tcgPlayerUsd),
      basis: "tcg_player",
      tcgPlayerUsd: Math.round(tcgPlayerUsd),
      priceChartingUsd,
      sourceLabel,
    };
  }

  if (ebayRaw != null) {
    return {
      usd: ebayRaw.usd,
      basis: ebayRaw.basis,
      tcgPlayerUsd: null,
      priceChartingUsd,
      sourceLabel: ebayRaw.sourceLabel,
    };
  }

  const cardMarketUsd = primaryCardMarketFromSnapshot(args.prices);
  if (cardMarketUsd != null) {
    return {
      usd: cardMarketUsd,
      basis: "reference_median",
      tcgPlayerUsd: null,
      priceChartingUsd,
      sourceLabel: priceChartingUsd != null ? "Cardmarket · PriceCharting" : "Cardmarket",
    };
  }

  if (priceChartingUsd != null) {
    return {
      usd: priceChartingUsd,
      basis: "pricecharting",
      tcgPlayerUsd: null,
      priceChartingUsd,
      sourceLabel: "PriceCharting",
    };
  }

  const ref = bestCatalogUsd(
    args.prices ?? {
      tcgPlayerPrices: [],
      cardMarket: null,
      tcgPlayerUrl: null,
      tcgPlayerUpdatedAt: null,
      cardMarketUrl: null,
      cardMarketUpdatedAt: null,
    },
  );
  if (ref != null) {
    return {
      usd: Math.round(ref),
      basis: "reference_median",
      tcgPlayerUsd: null,
      priceChartingUsd: null,
      sourceLabel: "Reference",
    };
  }

  return {
    usd: null,
    basis: null,
    tcgPlayerUsd: null,
    priceChartingUsd: null,
    sourceLabel: "—",
  };
}

export function catalogRawFmvToFairValueBasis(
  basis: CatalogRawFmvBasis | null,
): FairValueBasis | null {
  if (!basis) return null;
  if (basis === "tcg_player") return "tcg_catalog";
  if (basis === "pricecharting") return "reference_median";
  return basis;
}

export function formatCatalogFmvUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${Math.round(n).toLocaleString()}`;
}

export type CatalogCardPriceInput = {
  catalogPrices?: CatalogPriceSnapshot | null;
  tcgplayer?: {
    url?: string;
    updatedAt?: string;
    prices?: Record<
      string,
      { low?: number; mid?: number; high?: number; market?: number; directLow?: number }
    >;
  };
  cardmarket?: {
    url?: string;
    updatedAt?: string;
    prices?: {
      averageSellPrice?: number;
      trendPrice?: number;
      lowPrice?: number;
      avg7?: number;
      avg30?: number;
      reverseHoloTrend?: number;
    };
  };
};

/** Merge DB snapshot with live Pokémon TCG API embeds (master catalog grid). */
export function catalogPriceSnapshotFromCardInput(
  input: CatalogCardPriceInput,
): CatalogPriceSnapshot {
  const base = input.catalogPrices ?? parseCatalogPriceSnapshot(null);

  const tp = input.tcgplayer?.prices;
  const hasEmbedTp = tp && Object.keys(tp).length > 0;
  const hasSnapshotTp = base.tcgPlayerPrices.some(
    (r) => r.market != null || r.mid != null || r.low != null,
  );

  let tcgPlayerPrices = base.tcgPlayerPrices;
  if (hasEmbedTp && !hasSnapshotTp) {
    tcgPlayerPrices = Object.entries(tp).map(([variant, p]) => ({
      variant,
      market: typeof p.market === "number" ? p.market : null,
      mid: typeof p.mid === "number" ? p.mid : null,
      low: typeof p.low === "number" ? p.low : null,
      high: typeof p.high === "number" ? p.high : null,
      directLow: typeof p.directLow === "number" ? p.directLow : null,
    }));
  }

  let cardMarket = base.cardMarket;
  const cm = input.cardmarket?.prices;
  const hasEmbedCm =
    cm &&
    (cm.trendPrice != null ||
      cm.averageSellPrice != null ||
      cm.lowPrice != null ||
      cm.avg7 != null);
  const hasSnapshotCm =
    cardMarket != null &&
    (cardMarket.trendPrice != null || cardMarket.averageSellPrice != null);

  if (hasEmbedCm && !hasSnapshotCm) {
    cardMarket = {
      averageSellPrice: cm.averageSellPrice ?? null,
      trendPrice: cm.trendPrice ?? null,
      lowPrice: cm.lowPrice ?? null,
      avg7: cm.avg7 ?? null,
      avg30: cm.avg30 ?? null,
      reverseHoloTrend: cm.reverseHoloTrend ?? null,
    };
  }

  return {
    tcgPlayerUrl: input.tcgplayer?.url ?? base.tcgPlayerUrl,
    tcgPlayerUpdatedAt: input.tcgplayer?.updatedAt ?? base.tcgPlayerUpdatedAt,
    tcgPlayerPrices,
    cardMarketUrl: input.cardmarket?.url ?? base.cardMarketUrl,
    cardMarketUpdatedAt: input.cardmarket?.updatedAt ?? base.cardMarketUpdatedAt,
    cardMarket,
    priceChartingLooseUsd: base.priceChartingLooseUsd,
    priceChartingUrl: base.priceChartingUrl,
    priceChartingUpdatedAt: base.priceChartingUpdatedAt,
  };
}

export function resolveCatalogRawFmvForCard(
  input: CatalogCardPriceInput & {
    catalogFinish?: "reverse_holo";
    rarity?: string | null;
    identity?: CatalogRawFmvIdentity | null;
    marketEvidence?: MarketEvidence[];
  },
): CatalogRawFmv {
  const prices = catalogPriceSnapshotFromCardInput(input);
  return resolveCatalogRawFmv({
    prices,
    marketEvidence: input.marketEvidence,
    catalogFinish: input.catalogFinish,
    rarity: input.rarity,
    identity: input.identity,
  });
}

export function tcgPlayerEmbedFromSnapshot(
  prices: CatalogPriceSnapshot | null | undefined,
): {
  url?: string;
  updatedAt?: string;
  prices?: Record<string, { low?: number; mid?: number; high?: number; market?: number }>;
} | undefined {
  if (!prices?.tcgPlayerPrices.length && !prices?.tcgPlayerUrl) return undefined;
  const priceMap: Record<string, { low?: number; mid?: number; high?: number; market?: number }> =
    {};
  for (const row of prices.tcgPlayerPrices) {
    priceMap[row.variant] = {
      market: row.market ?? undefined,
      mid: row.mid ?? undefined,
      low: row.low ?? undefined,
      high: row.high ?? undefined,
    };
  }
  return {
    url: prices.tcgPlayerUrl ?? undefined,
    updatedAt: prices.tcgPlayerUpdatedAt ?? undefined,
    prices: Object.keys(priceMap).length ? priceMap : undefined,
  };
}
