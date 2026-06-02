import { parseCatalogPriceSnapshot } from "@/lib/market/catalog-reference-evidence";
import type { CatalogPriceSnapshot } from "@/lib/market/pokemon-catalog";
import {
  pickPriceUsd,
  pickPrimaryTierRow,
  pickSpotUsd,
  pickUsMomentumTierRow,
  pokeTraceTrendPct,
  trendLabelFromPct,
  isPokeTraceAnomaly,
} from "@/lib/market/poketrace/tiers";
import type { PokeTraceCard, PokeTracePriceSource } from "@/lib/market/poketrace/types";
import type { PokeTraceCatalogMeta } from "@/lib/market/pokemon-catalog";
import type { ExtractedCard } from "@/lib/scan/schemas";

function tcgVariantFromTier(tier: string): string {
  if (/REVERSE/i.test(tier)) return "reverseHolofoil";
  if (/1ST/i.test(tier)) return "1stEditionHolofoil";
  if (/HOLO/i.test(tier)) return "holofoil";
  return "normal";
}

function mergeTcgFromSource(
  snapshot: CatalogPriceSnapshot,
  sourceKey: PokeTracePriceSource,
  tier: string,
  priceUsd: number,
  tcgUrl: string | null,
  observedAt: string | null,
): void {
  if (sourceKey !== "tcgplayer") return;
  const variant = tcgVariantFromTier(tier);
  const existing = snapshot.tcgPlayerPrices.find((p) => p.variant === variant);
  if (existing) {
    existing.market = priceUsd;
    return;
  }
  snapshot.tcgPlayerPrices.push({
    variant,
    low: null,
    mid: priceUsd,
    high: null,
    market: priceUsd,
    directLow: null,
  });
  if (tcgUrl && !snapshot.tcgPlayerUrl) snapshot.tcgPlayerUrl = tcgUrl;
  if (observedAt && !snapshot.tcgPlayerUpdatedAt) snapshot.tcgPlayerUpdatedAt = observedAt;
}

function mergeCardMarketFromSource(
  snapshot: CatalogPriceSnapshot,
  sourceKey: PokeTracePriceSource,
  row: { avg?: number; median7d?: number; median30d?: number },
  cmUrl: string | null,
  observedAt: string | null,
): void {
  if (sourceKey !== "cardmarket" && sourceKey !== "cardmarket_unsold") return;
  const trend = pickSpotUsd(row);
  const avg7 = typeof row.median7d === "number" ? row.median7d : null;
  const avg30 = typeof row.median30d === "number" ? row.median30d : null;
  snapshot.cardMarket = {
    averageSellPrice: sourceKey === "cardmarket" ? trend : snapshot.cardMarket?.averageSellPrice ?? null,
    trendPrice: trend,
    lowPrice: snapshot.cardMarket?.lowPrice ?? null,
    avg7,
    avg30,
    reverseHoloTrend: snapshot.cardMarket?.reverseHoloTrend ?? null,
  };
  if (cmUrl && !snapshot.cardMarketUrl) snapshot.cardMarketUrl = cmUrl;
  if (observedAt && !snapshot.cardMarketUpdatedAt) snapshot.cardMarketUpdatedAt = observedAt;
}

export function buildCatalogSnapshotFromPokeTrace(
  pokeCard: PokeTraceCard,
  card: ExtractedCard,
  options?: {
    existing?: CatalogPriceSnapshot | null;
    historyPoints?: number;
    market?: "US" | "EU";
  },
): { snapshot: CatalogPriceSnapshot; meta: PokeTraceCatalogMeta } {
  const base = options?.existing ?? parseCatalogPriceSnapshot(null);
  const primary = pickPrimaryTierRow(card, pokeCard);
  const usMomentum = pickUsMomentumTierRow(card, pokeCard);
  const observedAt = pokeCard.lastUpdated?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
  const tcgUrl = pokeCard.refs?.tcgplayerId
    ? `https://www.tcgplayer.com/product/${pokeCard.refs.tcgplayerId}`
    : `https://poketrace.com/cards/${pokeCard.id}`;

  if (usMomentum?.sourceKey === "tcgplayer") {
    const priceUsd = pickPriceUsd(usMomentum.row) ?? 0;
    mergeTcgFromSource(base, "tcgplayer", usMomentum.tier, priceUsd, tcgUrl, observedAt);
  } else if (primary) {
    const priceUsd = pickPriceUsd(primary.row) ?? 0;
    mergeTcgFromSource(base, primary.sourceKey, primary.tier, priceUsd, tcgUrl, observedAt);
    mergeCardMarketFromSource(base, primary.sourceKey, primary.row, tcgUrl, observedAt);
  }

  const momentumRow = usMomentum;
  const momentumPct = momentumRow ? pokeTraceTrendPct(momentumRow.row) : null;
  const meta: PokeTraceCatalogMeta = {
    cardId: pokeCard.id,
    syncedAt: new Date().toISOString(),
    market: options?.market ?? "US",
    primaryTier: momentumRow?.tier ?? null,
    primarySource: momentumRow?.sourceKey ?? null,
    momentumPct,
    trendLabel: trendLabelFromPct(momentumPct),
    anomalyFlag: momentumRow ? isPokeTraceAnomaly(momentumRow.row) : false,
    historyPoints: options?.historyPoints ?? 0,
    lastSpotUsd: momentumRow ? pickSpotUsd(momentumRow.row) : null,
    median7dUsd: momentumRow ? pickPriceUsd(momentumRow.row, "7d") : null,
    median30dUsd: momentumRow ? pickPriceUsd(momentumRow.row, "30d") : null,
  };

  return {
    snapshot: {
      ...base,
      pokeTrace: meta,
    },
    meta,
  };
}
