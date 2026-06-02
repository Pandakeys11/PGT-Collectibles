import { getCardFromDb } from "@/lib/catalog/db-catalog-browse";
import type { CatalogCardSummary } from "@/lib/catalog/catalog-types";
import { isUsCatalogMomentum, resolveCatalogMomentum } from "@/lib/market/catalog-momentum";
import { parseCatalogPriceSnapshot } from "@/lib/market/catalog-reference-evidence";
import { isPokeTraceConfigured } from "@/lib/market/env-market";
import { refreshPokeTraceCatalogPrices } from "@/lib/market/poketrace/sync-catalog";
import {
  cardInsightRow,
  priceSnapshotFromTcgCard,
  pricesForInsightCard,
  type SetInsightCardSource,
} from "@/lib/catalog/set-insight-utils";
import type { TcgCardSummary } from "@/lib/pokedex/tcg-api-types";

function needsUsMomentum(card: SetInsightCardSource): boolean {
  return !isUsCatalogMomentum(pricesForInsightCard(card));
}

/** Refresh PokeTrace US 7d/30d for cards still on EU-only Cardmarket momentum. */
export async function hydrateSetUsMomentum(
  cards: SetInsightCardSource[],
  options?: { limit?: number; delayMs?: number },
): Promise<SetInsightCardSource[]> {
  if (!isPokeTraceConfigured() || cards.length === 0) return cards;

  const limit = options?.limit ?? 48;
  const delayMs = options?.delayMs ?? 120;
  const targets = cards
    .filter(needsUsMomentum)
    .sort((a, b) => (cardInsightRow(b).priceUsd ?? 0) - (cardInsightRow(a).priceUsd ?? 0))
    .slice(0, limit);
  if (!targets.length) return cards;

  const byId = new Map(cards.map((c) => [c.id, c]));

  for (const card of targets) {
    try {
      const ok = await refreshPokeTraceCatalogPrices(card.id);
      if (!ok) continue;
      const row = await getCardFromDb("pokemon", card.id);
      if (!row?.prices) continue;
      const merged = mergeCardPrices(card, row);
      byId.set(card.id, merged);
    } catch {
      /* continue batch */
    }
    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return cards.map((c) => byId.get(c.id) ?? c);
}

function mergeCardPrices(
  card: SetInsightCardSource,
  row: CatalogCardSummary,
): SetInsightCardSource {
  const snap = row.prices ?? parseCatalogPriceSnapshot(null);
  if (!resolveCatalogMomentum(snap).pct) return card;

  if ("prices" in card) {
    return { ...card, prices: snap } satisfies CatalogCardSummary;
  }

  return {
    ...(card as TcgCardSummary),
    catalogPrices: snap,
    tcgplayer: row.prices?.tcgPlayerPrices.length
      ? tcgEmbedFromSnapshot(snap)
      : (card as TcgCardSummary).tcgplayer,
    cardmarket: snap.cardMarket
      ? {
          url: snap.cardMarketUrl ?? undefined,
          updatedAt: snap.cardMarketUpdatedAt ?? undefined,
          prices: {
            trendPrice: snap.cardMarket.trendPrice ?? undefined,
            averageSellPrice: snap.cardMarket.averageSellPrice ?? undefined,
            lowPrice: snap.cardMarket.lowPrice ?? undefined,
            avg7: snap.cardMarket.avg7 ?? undefined,
            avg30: snap.cardMarket.avg30 ?? undefined,
            reverseHoloTrend: snap.cardMarket.reverseHoloTrend ?? undefined,
          },
        }
      : (card as TcgCardSummary).cardmarket,
  } satisfies TcgCardSummary;
}

function tcgEmbedFromSnapshot(snap: ReturnType<typeof parseCatalogPriceSnapshot>) {
  const prices: Record<string, { market?: number; mid?: number; low?: number; high?: number }> = {};
  for (const row of snap.tcgPlayerPrices) {
    prices[row.variant] = {
      market: row.market ?? undefined,
      mid: row.mid ?? undefined,
      low: row.low ?? undefined,
      high: row.high ?? undefined,
    };
  }
  return {
    url: snap.tcgPlayerUrl ?? undefined,
    updatedAt: snap.tcgPlayerUpdatedAt ?? undefined,
    prices,
  };
}
