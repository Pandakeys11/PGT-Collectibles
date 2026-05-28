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
  matchesBgsBlackLabel,
  matchesCgcPristine10,
  matchesPsa10,
  matchesPsa9,
} from "@/lib/market/grade-match";
import type { ExtractedCard, MarketEvidence } from "@/lib/scan/schemas";

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

function excludeGraded(item: MarketEvidence): boolean {
  return !matchesPsa10(item) && !matchesPsa9(item) && !matchesBgsBlackLabel(item) && !matchesCgcPristine10(item);
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

function filterRawEvidence(
  evidence: MarketEvidence[],
  identity?: CatalogRawFmvIdentity | null,
): MarketEvidence[] {
  const raw = evidence.filter(excludeGraded);
  const card = toExtractedCard(identity);
  if (!card) return raw;
  return filterMarketEvidenceForCardIdentity(raw, card);
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

  const maxMarket = (pool: Row[]): number | null => {
    const m = pool.map((e) => e.market).filter((n): n is number => n != null);
    return m.length ? Math.max(...m) : null;
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

  let out = maxMarket(pool);
  if (out == null) out = maxMarket(entries);
  if (out == null) {
    const mids = entries.map((e) => e.mid).filter((n): n is number => n != null);
    out = mids.length ? Math.max(...mids) : null;
  }
  return out;
}

export function priceChartingUsdFromSnapshot(
  prices: CatalogPriceSnapshot | null | undefined,
): number | null {
  const n = prices?.priceChartingLooseUsd;
  return isUsd(n) ? Math.round(n) : null;
}

export function priceChartingUsdFromEvidence(evidence: MarketEvidence[]): number | null {
  const rows = evidence.filter(
    (e) =>
      e.source === "PriceCharting" &&
      typeof e.priceUsd === "number" &&
      /loose|ungraded|raw|nm|near mint/i.test(e.title),
  );
  if (!rows.length) {
    const any = evidence.find(
      (e) => e.source === "PriceCharting" && typeof e.priceUsd === "number",
    );
    return any?.priceUsd != null ? Math.round(any.priceUsd) : null;
  }
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
 * TCGPlayer (catalog) → identity-matched listings → PriceCharting (validated) → sold comps.
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
  const activeUsd = medianActiveRaw(filtered, cardNumber);
  const soldUsd = medianSoldRaw(filtered, cardNumber);
  let priceChartingUsd =
    priceChartingUsdFromSnapshot(args.prices) ?? priceChartingUsdFromEvidence(filtered);
  if (
    priceChartingUsd != null &&
    !priceChartingTrusted(priceChartingUsd, activeUsd, soldUsd)
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

  if (activeUsd != null) {
    return {
      usd: activeUsd,
      basis: "active_median",
      tcgPlayerUsd: null,
      priceChartingUsd,
      sourceLabel: "Matched listings",
    };
  }

  if (soldUsd != null) {
    return {
      usd: soldUsd,
      basis: "sold_median",
      tcgPlayerUsd: null,
      priceChartingUsd: null,
      sourceLabel: "Matched sold",
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
