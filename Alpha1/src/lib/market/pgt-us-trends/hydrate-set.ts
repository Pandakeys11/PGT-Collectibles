import type { CatalogCardSummary } from "@/lib/catalog/catalog-types";
import {
  cardInsightRow,
  pricesForInsightCard,
  type SetInsightCardSource,
} from "@/lib/catalog/set-insight-utils";
import { resolvedCatalogMomentumPct } from "@/lib/market/catalog-momentum";
import { loadPgtUsTrendsForCatalogIds } from "@/lib/market/pgt-us-trends/load-trends";
import { recordPgtUsPriceTickFromSnapshot } from "@/lib/market/pgt-us-trends/persist-ticks";
import type { CatalogPriceSnapshot } from "@/lib/market/pokemon-catalog";
import type { TcgCardSummary } from "@/lib/pokedex/tcg-api-types";

function applyPgtUsToCard(
  card: SetInsightCardSource,
  snap: CatalogPriceSnapshot,
): SetInsightCardSource {
  if ("prices" in card) {
    return { ...card, prices: snap } satisfies CatalogCardSummary;
  }
  return {
    ...(card as TcgCardSummary),
    catalogPrices: snap,
  } satisfies TcgCardSummary;
}

/**
 * Attach PGT-owned US trends from comps + price ticks; record today's TCG anchor.
 */
export async function hydrateSetPgtUsTrends(
  cards: SetInsightCardSource[],
): Promise<SetInsightCardSource[]> {
  if (!cards.length) return cards;

  const needsTrend = cards.filter((c) => {
    const snap = pricesForInsightCard(c);
    if (snap.pgtUs?.momentumPct != null) return false;
    return resolvedCatalogMomentumPct(snap) == null;
  });

  const ids = needsTrend.map((c) => c.id);
  const trends = ids.length ? await loadPgtUsTrendsForCatalogIds(ids) : new Map();

  const byId = new Map(cards.map((c) => [c.id, c]));

  for (const card of cards) {
    const prior = pricesForInsightCard(card);
    void recordPgtUsPriceTickFromSnapshot(card.id, prior);

    const trend = trends.get(card.id);
    if (!trend) continue;
    if (prior.pgtUs?.momentumPct != null) continue;

    const next: CatalogPriceSnapshot = {
      ...prior,
      pgtUs: trend.meta,
    };
    if (resolvedCatalogMomentumPct(next) != null) {
      byId.set(card.id, applyPgtUsToCard(card, next));
    }
  }

  return cards.map((c) => byId.get(c.id) ?? c);
}

/** Top cards by FMV that still lack any momentum after PGT hydrate. */
export function cardsStillNeedingExternalMomentum(
  cards: SetInsightCardSource[],
  limit = 48,
): SetInsightCardSource[] {
  return cards
    .filter((c) => resolvedCatalogMomentumPct(pricesForInsightCard(c)) == null)
    .sort((a, b) => (cardInsightRow(b).priceUsd ?? 0) - (cardInsightRow(a).priceUsd ?? 0))
    .slice(0, limit);
}
