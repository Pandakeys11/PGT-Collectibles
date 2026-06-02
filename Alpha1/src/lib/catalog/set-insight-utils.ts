import type { CatalogCardSummary } from "@/lib/catalog/catalog-types";
import type { CatalogPriceSnapshot } from "@/lib/market/pokemon-catalog";
import { parseCatalogPriceSnapshot } from "@/lib/market/catalog-reference-evidence";
import { bestCatalogUsd } from "@/lib/market/catalog-price-utils";
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

function pricesForInsightCard(card: SetInsightCardSource): CatalogPriceSnapshot {
  if ("prices" in card && card.prices) return card.prices;
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

/** Momentum: PokeTrace medians first, then Cardmarket trend vs 7d, then WS overlay. */
export function catalogMomentumPct(prices: CatalogPriceSnapshot): number | null {
  if (prices.pokeTrace?.momentumPct != null) {
    return prices.pokeTrace.momentumPct;
  }
  const cm = prices.cardMarket;
  if (!cm?.trendPrice || !cm.avg7 || cm.avg7 <= 0) return null;
  return Math.round(((cm.trendPrice - cm.avg7) / cm.avg7) * 1000) / 10;
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
  return {
    catalogId: card.id,
    name: card.name,
    number,
    rarity,
    imageUrl: card.images?.small ?? card.images?.large ?? null,
    priceUsd: fmv.usd ?? bestTcgUsd(prices),
    momentumPct: catalogMomentumPct(prices),
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
    if (primaryTcgPlayerFromSnapshot(existing, { catalogFinish: finish, rarity: card.rarity }) != null) {
      return card;
    }

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

    const mergedPrices = priceSnapshotFromTcgCard(hit);
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

export function topMomentumCards(
  cards: SetInsightCardSource[],
  limit = 4,
  evidenceByCatalogId?: Map<string, MarketEvidence[]>,
): SetInsightCardRow[] {
  const rows = cards
    .map((c) => cardInsightRow(c, evidenceByCatalogId?.get(c.id)))
    .filter((r) => r.momentumPct != null && r.momentumPct !== 0);

  const strong = rows
    .filter((r) => Math.abs(r.momentumPct!) >= 3)
    .sort((a, b) => Math.abs(b.momentumPct ?? 0) - Math.abs(a.momentumPct ?? 0));

  const pool = strong.length > 0 ? strong : rows.sort((a, b) => Math.abs(b.momentumPct ?? 0) - Math.abs(a.momentumPct ?? 0));
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
