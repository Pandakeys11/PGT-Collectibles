import type { CatalogCardSummary } from "@/lib/catalog/catalog-types";
import type { CatalogPriceSnapshot } from "@/lib/market/pokemon-catalog";
import { parseCatalogPriceSnapshot } from "@/lib/market/catalog-reference-evidence";
import {
  resolveCatalogMomentum,
  resolvedCatalogMomentumPct,
} from "@/lib/market/catalog-momentum";
import { cardmarketMomentumPct7dVs30d } from "@/lib/market/cardmarket-eur";
import { primaryTcgPlayerFromSnapshot } from "@/lib/market/catalog-raw-fmv";
import { resolveCatalogRawFmv } from "@/lib/market/catalog-raw-fmv";
import type { TcgCardSetEmbed, TcgCardSummary } from "@/lib/pokedex/tcg-api-types";
import type { MarketEvidence } from "@/lib/scan/schemas";

/** Cards from master catalog DB or live TCG API — both feed set insight rollups. */
export type SetInsightCardSource = CatalogCardSummary | TcgCardSummary;

function toTcgSetEmbed(
  set: { id: string; name: string; code?: string | null; releaseDate?: string | null } | TcgCardSetEmbed | undefined,
): TcgCardSetEmbed | undefined {
  if (!set) return undefined;
  return {
    id: set.id,
    name: set.name,
    releaseDate: set.releaseDate ?? undefined,
    ...("series" in set && set.series ? { series: set.series } : {}),
    ...("printedTotal" in set && set.printedTotal != null ? { printedTotal: set.printedTotal } : {}),
    ...("total" in set && set.total != null ? { total: set.total } : {}),
  };
}

function normalizeInsightKey(name: string, number: string | null | undefined): string {
  const n = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const raw = (number ?? "").replace(/^#/, "").trim();
  const primary = (raw.split("/")[0] ?? raw).replace(/^0+/, "").trim() || raw;
  return `${n}|${primary}`;
}

export function priceSnapshotFromTcgCard(card: TcgCardSummary): CatalogPriceSnapshot {
  const tcgPlayerPrices = card.tcgplayer?.prices
    ? Object.entries(card.tcgplayer.prices).map(([variant, p]) => ({
        variant,
        low: p?.low ?? null,
        mid: p?.mid ?? null,
        high: p?.high ?? null,
        market: p?.market ?? null,
        directLow: p?.directLow ?? null,
      }))
    : [];
  const cm = card.cardmarket?.prices;
  return {
    tcgPlayerUrl: card.tcgplayer?.url ?? null,
    tcgPlayerUpdatedAt: card.tcgplayer?.updatedAt ?? null,
    tcgPlayerPrices,
    cardMarketUrl: card.cardmarket?.url ?? null,
    cardMarketUpdatedAt: card.cardmarket?.updatedAt ?? null,
    cardMarket: cm
      ? {
          averageSellPrice: cm.averageSellPrice ?? null,
          trendPrice: cm.trendPrice ?? null,
          lowPrice: cm.lowPrice ?? null,
          avg7: cm.avg7 ?? null,
          avg30: cm.avg30 ?? null,
          reverseHoloTrend: cm.reverseHoloTrend ?? null,
        }
      : null,
  };
}

function isTcgInsightCard(card: SetInsightCardSource): card is TcgCardSummary {
  return "tcgplayer" in card || "cardmarket" in card;
}

/** DB `prices`, hydrated `catalogPrices`, then live TCG API embed — order matters after PokeTrace sync. */
export function pricesForInsightCard(card: SetInsightCardSource): CatalogPriceSnapshot {
  if ("prices" in card && card.prices) return card.prices;
  if ("catalogPrices" in card && card.catalogPrices) return card.catalogPrices;
  if (isTcgInsightCard(card)) return priceSnapshotFromTcgCard(card);
  return parseCatalogPriceSnapshot(null);
}

export type SetInsightCardRow = {
  catalogId: string;
  name: string;
  number: string | null;
  rarity: string | null;
  imageUrl: string | null;
  priceUsd: number | null;
  momentumPct: number | null;
  momentumLabel: string | null;
  momentumDeltaUsd: number | null;
  momentumRegion: "us" | "eu" | null;
  priceLabel: string | null;
};

export type SetInsightRollup = {
  cardCount: number;
  tcgPlayerSumUsd: number;
  pricedSlots: number;
};

function bestTcgUsd(prices: CatalogPriceSnapshot): number | null {
  let best: number | null = null;
  for (const row of prices.tcgPlayerPrices) {
    const n = row.market ?? row.mid ?? row.low;
    if (n == null || !Number.isFinite(n)) continue;
    if (best == null || n > best) best = n;
  }
  return best;
}

/** @see resolveCatalogMomentum — US 7d vs 30d first, EU Cardmarket fallback. */
export function catalogMomentumPct(prices: CatalogPriceSnapshot): number | null {
  return resolvedCatalogMomentumPct(prices);
}

export function cardInsightRow(
  card: SetInsightCardSource,
  marketEvidence?: MarketEvidence[],
): SetInsightCardRow {
  const prices = pricesForInsightCard(card);
  const number = card.number ?? null;
  const rarity = card.rarity ?? null;
  const catalogFinish =
    "catalogFinish" in card && card.catalogFinish === "reverse_holo" ? "reverse_holo" : undefined;
  const fmv = resolveCatalogRawFmv({
    prices,
    marketEvidence,
    catalogFinish,
    rarity,
    identity: { name: card.name, number, set: card.set?.name ?? null },
  });
  const momentum = resolveCatalogMomentum(prices);
  return {
    catalogId: card.id,
    name: card.name,
    number,
    rarity,
    imageUrl: card.images?.small ?? card.images?.large ?? null,
    priceUsd: fmv.usd ?? bestTcgUsd(prices),
    priceLabel: fmv.sourceLabel,
    momentumPct: momentum.pct,
    momentumLabel: momentum.pct != null ? momentum.label : null,
    momentumDeltaUsd: momentum.deltaUsd,
    momentumRegion: momentum.region,
  };
}

export function cardInsightPriceLabel(
  card: SetInsightCardSource,
  marketEvidence?: MarketEvidence[],
): string {
  const prices = pricesForInsightCard(card);
  const catalogFinish =
    "catalogFinish" in card && card.catalogFinish === "reverse_holo" ? "reverse_holo" : undefined;
  const fmv = resolveCatalogRawFmv({
    prices,
    marketEvidence,
    catalogFinish,
    rarity: card.rarity ?? null,
    identity: {
      name: card.name,
      number: card.number ?? null,
      set: card.set?.name ?? null,
    },
  });
  return fmv.sourceLabel;
}

function snapshotNeedsCardmarketMomentum(existing: CatalogPriceSnapshot): boolean {
  if (resolvedCatalogMomentumPct(existing) != null) return false;
  const cm = existing.cardMarket;
  if (cm && cardmarketMomentumPct7dVs30d(cm) != null) return false;
  return true;
}

function mergeLiveIntoSnapshot(
  existing: CatalogPriceSnapshot,
  live: CatalogPriceSnapshot,
): CatalogPriceSnapshot {
  const cm = live.cardMarket;
  const hasCmMomentum =
    cm != null && cm.avg7 != null && cm.avg30 != null && cm.avg30 > 0;
  return {
    ...existing,
    tcgPlayerUrl: existing.tcgPlayerUrl ?? live.tcgPlayerUrl,
    tcgPlayerUpdatedAt: existing.tcgPlayerUpdatedAt ?? live.tcgPlayerUpdatedAt,
    tcgPlayerPrices:
      existing.tcgPlayerPrices.length > 0 ? existing.tcgPlayerPrices : live.tcgPlayerPrices,
    cardMarketUrl: existing.cardMarketUrl ?? live.cardMarketUrl,
    cardMarketUpdatedAt: existing.cardMarketUpdatedAt ?? live.cardMarketUpdatedAt,
    cardMarket: hasCmMomentum
      ? {
          averageSellPrice: cm.averageSellPrice ?? existing.cardMarket?.averageSellPrice ?? null,
          trendPrice: cm.trendPrice ?? existing.cardMarket?.trendPrice ?? null,
          lowPrice: cm.lowPrice ?? existing.cardMarket?.lowPrice ?? null,
          avg7: cm.avg7 ?? null,
          avg30: cm.avg30 ?? null,
          reverseHoloTrend:
            cm.reverseHoloTrend ?? existing.cardMarket?.reverseHoloTrend ?? null,
        }
      : existing.cardMarket,
  };
}

/** Share of cards with any 7d/30d momentum signal (US or EU). */
export function setMomentumCoverage(cards: SetInsightCardSource[]): number {
  if (!cards.length) return 0;
  let n = 0;
  for (const card of cards) {
    if (resolvedCatalogMomentumPct(pricesForInsightCard(card)) != null) n += 1;
  }
  return n / cards.length;
}

/** Fill missing TCGPlayer/Cardmarket snapshots from live Pokémon TCG API rows. */
export function enrichCardsWithLiveTcgPrices(
  catalogCards: SetInsightCardSource[],
  liveCards: TcgCardSummary[],
): SetInsightCardSource[] {
  if (!liveCards.length || !catalogCards.length) return catalogCards;

  const byApiId = new Map<string, TcgCardSummary>();
  const byKey = new Map<string, TcgCardSummary>();
  for (const live of liveCards) {
    byApiId.set(live.id, live);
    byKey.set(normalizeInsightKey(live.name, live.number), live);
  }

  return catalogCards.map((card) => {
    const existing = pricesForInsightCard(card);
    const finish =
      "catalogFinish" in card && card.catalogFinish === "reverse_holo"
        ? "reverse_holo"
        : undefined;
    const hasTcg = primaryTcgPlayerFromSnapshot(existing, {
      catalogFinish: finish,
      rarity: card.rarity,
    }) != null;
    const needsCm = snapshotNeedsCardmarketMomentum(existing);

    const apiId =
      ("sourceCatalogId" in card && card.sourceCatalogId?.trim()) ||
      ("id" in card &&
      typeof card.id === "string" &&
      /^[a-z0-9]{2,}-[a-z0-9]+/i.test(card.id)
        ? card.id.trim()
        : null);
    const hit =
      (apiId ? byApiId.get(apiId) : undefined) ??
      byKey.get(normalizeInsightKey(card.name, card.number ?? null));
    if (!hit) return card;

    const liveSnap = priceSnapshotFromTcgCard(hit);
    const mergedPrices = hasTcg && needsCm
      ? mergeLiveIntoSnapshot(existing, liveSnap)
      : liveSnap;

    if (hasTcg && !needsCm) return card;

    if ("prices" in card) {
      return { ...card, prices: mergedPrices } satisfies CatalogCardSummary;
    }
    return {
      ...hit,
      id: card.id,
      images: card.images ?? hit.images,
      set: toTcgSetEmbed(card.set) ?? hit.set,
      catalogFinish: "catalogFinish" in card ? card.catalogFinish : hit.catalogFinish,
      catalogVariantKey: "catalogVariantKey" in card ? card.catalogVariantKey : hit.catalogVariantKey,
      catalogVariantLabel:
        "catalogVariantLabel" in card ? card.catalogVariantLabel : hit.catalogVariantLabel,
      sourceCatalogId: apiId ?? hit.id,
      catalogPrices: mergedPrices,
    } satisfies TcgCardSummary;
  });
}

export function rollupSetInsightCards(
  cards: SetInsightCardSource[],
  evidenceByCatalogId?: Map<string, MarketEvidence[]>,
): SetInsightRollup {
  let tcgPlayerSumUsd = 0;
  let pricedSlots = 0;
  for (const card of cards) {
    const row = cardInsightRow(card, evidenceByCatalogId?.get(card.id));
    if (row.priceUsd != null) {
      tcgPlayerSumUsd += row.priceUsd;
      pricedSlots += 1;
    }
  }
  return {
    cardCount: cards.length,
    tcgPlayerSumUsd: Math.round(tcgPlayerSumUsd * 100) / 100,
    pricedSlots,
  };
}

export function isPromoLikeCard(card: SetInsightCardSource): boolean {
  const r = (card.rarity ?? "").toLowerCase();
  const n = card.name.toLowerCase();
  return (
    r.includes("promo") ||
    n.includes("promo") ||
    r.includes("black star") ||
    r.includes("prize")
  );
}

export function topValueCards(
  cards: SetInsightCardSource[],
  limit = 5,
  evidenceByCatalogId?: Map<string, MarketEvidence[]>,
): SetInsightCardRow[] {
  return cards
    .map((c) => cardInsightRow(c, evidenceByCatalogId?.get(c.id)))
    .filter((r) => r.priceUsd != null)
    .sort((a, b) => (b.priceUsd ?? 0) - (a.priceUsd ?? 0))
    .slice(0, limit);
}

const SET_INSIGHT_STRONG_MOMENTUM_PCT = 3;

export function topMomentumCards(
  cards: SetInsightCardSource[],
  limit = 4,
  evidenceByCatalogId?: Map<string, MarketEvidence[]>,
): SetInsightCardRow[] {
  const rows = cards
    .map((c) => cardInsightRow(c, evidenceByCatalogId?.get(c.id)))
    .filter((r) => r.momentumPct != null && r.momentumPct !== 0);

  const byStrength = (a: SetInsightCardRow, b: SetInsightCardRow) =>
    Math.abs(b.momentumPct ?? 0) - Math.abs(a.momentumPct ?? 0);

  const strong = rows
    .filter((r) => Math.abs(r.momentumPct!) >= SET_INSIGHT_STRONG_MOMENTUM_PCT)
    .sort(byStrength);

  const pool = strong.length > 0 ? strong : [...rows].sort(byStrength);
  return pool.slice(0, limit);
}

export function promoCardsInSet(
  cards: SetInsightCardSource[],
  limit = 5,
  evidenceByCatalogId?: Map<string, MarketEvidence[]>,
): SetInsightCardRow[] {
  return cards
    .filter(isPromoLikeCard)
    .map((c) => cardInsightRow(c, evidenceByCatalogId?.get(c.id)))
    .sort((a, b) => (b.priceUsd ?? 0) - (a.priceUsd ?? 0))
    .slice(0, limit);
}
