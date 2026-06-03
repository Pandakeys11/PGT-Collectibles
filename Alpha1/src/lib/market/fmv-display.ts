import type { CardListFmv } from "@/lib/scan/card-list-fmv";
import type { FairValueBasis } from "@/lib/market/fair-value";
import { formatCatalogFmvUsd } from "@/lib/market/catalog-raw-fmv";
import type { PokemonMarketKnowledge } from "@/lib/market/pokemon-market-knowledge-shared";

export const FMV_BASIS_PHRASE: Partial<Record<FairValueBasis, string>> = {
  sold_median: "recent sold median",
  active_median: "active listing median",
  reference_median: "price guide median",
  sticker_anchor: "sticker price",
  tcg_catalog: "TCGPlayer market",
  target_sold_median: "grade sold median",
  target_active_median: "grade listing median",
  target_reference_median: "grade guide median",
  nearest_sold_median: "nearest sold median",
};

export function formatFmvBasis(basis: FairValueBasis | null | undefined): string {
  if (!basis) return "insufficient comps";
  return FMV_BASIS_PHRASE[basis] ?? basis.replace(/_/g, " ");
}

export function formatFmvUsd(n: number | null | undefined): string {
  return formatCatalogFmvUsd(n);
}

export type CatalogRawFmvSeed = {
  rawFmvUsd: number | null;
  rawFmvBasis?: FairValueBasis | null;
  rawFmvSourceLabel?: string | null;
  tcgPlayerUsd?: number | null;
  priceChartingUsd?: number | null;
};

/** Build a minimal knowledge shell for instant catalog detail paint. */
export function knowledgeFromRawFmvSeed(
  catalogId: string,
  seed: CatalogRawFmvSeed,
): import("@/lib/market/pokemon-market-knowledge-shared").PokemonMarketKnowledge {
  const basis = seed.rawFmvBasis ?? null;
  return {
    catalogId,
    card: null,
    referencePrices: {
      tcgPlayerPrices: [],
      tcgPlayerUrl: null,
      tcgPlayerUpdatedAt: null,
      cardMarket: null,
      cardMarketUrl: null,
      cardMarketUpdatedAt: null,
    },
    intel: null,
    marketEvidence: [],
    intelligence: {
      targetBucket: "raw",
      fmvUsd: seed.rawFmvUsd,
      // This lightweight shell doesn't compute the grade-scoped ladder FMV basis.
      fmvBasis: null,
      confidence: seed.rawFmvUsd != null ? 0.55 : 0,
      confidenceLabel: seed.rawFmvUsd != null ? "medium" : "none",
      soldCount: 0,
      activeCount: 0,
      referenceCount: 0,
      auctionCount: 0,
      buyNowCount: 0,
      buckets: [],
    },
    fairValueUsd: seed.rawFmvUsd,
    fairValueBasis: basis,
    rawFmvUsd: seed.rawFmvUsd,
    rawFmvBasis: basis,
    tcgPlayerUsd: seed.tcgPlayerUsd ?? null,
    priceChartingUsd: seed.priceChartingUsd ?? null,
    rawFmvSourceLabel: seed.rawFmvSourceLabel?.trim() || "Catalog",
    institutionalMemory: false,
    dataDepth: {
      persistedComps: 0,
      catalogReferenceRows: 0,
      populationSnapshots: 0,
      certifications: 0,
    },
    refreshedAt: new Date().toISOString(),
  };
}

export type FmvLaneKind = "sold" | "market" | "trend" | "active" | "reference";

export type FmvLaneChip = {
  sourceId: string;
  label: string;
  usd: number | null;
  lane: FmvLaneKind;
};

export type FmvHeadline = {
  amount: string;
  amountUsd: number | null;
  basisLabel: string | null;
  sourceLabel: string | null;
  held: boolean;
  holdMessage: string | null;
  lanes: FmvLaneChip[];
  preview: boolean;
};

function laneUsd(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

export function buildFmvHeadlineFromKnowledge(
  knowledge: PokemonMarketKnowledge,
  options?: { held?: boolean; holdMessage?: string | null },
): FmvHeadline {
  const held = options?.held === true;
  const amountUsd = held ? null : knowledge.rawFmvUsd ?? knowledge.fairValueUsd;
  const basis = knowledge.rawFmvBasis ?? knowledge.fairValueBasis;
  const lanes: FmvLaneChip[] = [];

  const tcg = laneUsd(knowledge.tcgPlayerUsd);
  if (tcg != null) {
    lanes.push({ sourceId: "tcgplayer", label: "TCGPlayer", usd: tcg, lane: "market" });
  }
  const cm = knowledge.referencePrices.cardMarket;
  const trend = laneUsd(cm?.trendPrice ?? null);
  if (trend != null) {
    lanes.push({ sourceId: "cardmarket", label: "CM trend", usd: trend, lane: "trend" });
  }
  const pc = laneUsd(knowledge.priceChartingUsd);
  if (pc != null) {
    lanes.push({ sourceId: "pricecharting", label: "PC loose", usd: pc, lane: "reference" });
  }

  return {
    amount: held ? "—" : formatFmvUsd(amountUsd),
    amountUsd,
    basisLabel: basis ? formatFmvBasis(basis) : null,
    sourceLabel: knowledge.rawFmvSourceLabel?.trim() || null,
    held,
    holdMessage: options?.holdMessage ?? null,
    lanes,
    preview: held,
  };
}

export function buildFmvHeadlineFromScanFmv(fmv: CardListFmv): FmvHeadline {
  return {
    amount: fmv.fmvDisplay,
    amountUsd: fmv.fmvUsd,
    basisLabel: fmv.fmvBasis ? formatFmvBasis(fmv.fmvBasis) : null,
    sourceLabel: null,
    held: fmv.fmvHeld,
    holdMessage: fmv.fmvHoldMessage,
    lanes: [],
    preview: fmv.fmvHeld,
  };
}

export function buildFmvHeadlineFromCardMatch(card: {
  fmvUsd: number | null;
  fmvDisplay: string;
  fmvSubline: string | null;
  fmvBasis?: FairValueBasis | null;
  fmvHeld?: boolean;
  fmvHoldMessage?: string | null;
  fmvLanes?: FmvLaneChip[];
}): FmvHeadline {
  const held = card.fmvHeld === true;
  return {
    amount: card.fmvDisplay,
    amountUsd: held ? null : card.fmvUsd,
    basisLabel: held
      ? null
      : card.fmvBasis
        ? formatFmvBasis(card.fmvBasis)
        : card.fmvSubline,
    sourceLabel: null,
    held,
    holdMessage: card.fmvHoldMessage ?? null,
    lanes: card.fmvLanes ?? [],
    preview: held,
  };
}
