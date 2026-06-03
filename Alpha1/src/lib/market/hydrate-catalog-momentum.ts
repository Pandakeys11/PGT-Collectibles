import type { CatalogCardSummary } from "@/lib/catalog/catalog-types";
import {
  cardInsightRow,
  pricesForInsightCard,
  setMomentumCoverage,
  type SetInsightCardSource,
} from "@/lib/catalog/set-insight-utils";
import { resolvedCatalogMomentumPct, resolveCatalogMomentum } from "@/lib/market/catalog-momentum";
import { isJustTcgConfigured, isPokeTraceConfigured } from "@/lib/market/env-market";
import { hydrateSetMomentumFromJustTcg } from "@/lib/market/justtcg/hydrate-set-momentum";
import { hydrateSetPgtUsTrends } from "@/lib/market/pgt-us-trends/hydrate-set";
import { buildPokeTraceCatalogSnapshot } from "@/lib/market/poketrace/build-catalog-snapshot";
import { isPokeTraceRateLimited, pokeTraceRateLimitMessage } from "@/lib/market/poketrace/rate-limit";
import type { CatalogPriceSnapshot } from "@/lib/market/pokemon-catalog";
import type { TcgCardSummary } from "@/lib/pokedex/tcg-api-types";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

function needsMomentumBackfill(card: SetInsightCardSource): boolean {
  return resolvedCatalogMomentumPct(pricesForInsightCard(card)) == null;
}

function applySnapshotToCard(
  card: SetInsightCardSource,
  snap: CatalogPriceSnapshot,
): SetInsightCardSource {
  if ("prices" in card) {
    return { ...card, prices: snap } satisfies CatalogCardSummary;
  }

  return {
    ...(card as TcgCardSummary),
    catalogPrices: snap,
    tcgplayer: snap.tcgPlayerPrices.length
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

function tcgEmbedFromSnapshot(snap: CatalogPriceSnapshot) {
  const prices: Record<string, { market?: number; mid?: number; low?: number; high?: number }> =
    {};
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

async function hydratePokeTraceBatch(
  cards: SetInsightCardSource[],
  options?: { limit?: number; delayMs?: number },
): Promise<SetInsightCardSource[]> {
  const limit = options?.limit ?? 48;
  const delayMs = options?.delayMs ?? 80;
  const targets = cards
    .filter(needsMomentumBackfill)
    .sort((a, b) => (cardInsightRow(b).priceUsd ?? 0) - (cardInsightRow(a).priceUsd ?? 0))
    .slice(0, limit);
  if (!targets.length) return cards;

  const byId = new Map(cards.map((c) => [c.id, c]));

  for (const card of targets) {
    try {
      const snap = await buildPokeTraceCatalogSnapshot(card.id);
      if (!snap) continue;
      if (resolveCatalogMomentum(snap).pct != null) {
        byId.set(card.id, applySnapshotToCard(card, snap));
      }
    } catch {
      /* continue */
    }
    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return cards.map((c) => byId.get(c.id) ?? c);
}

export type HydrateSetMomentumResult = {
  cards: SetInsightCardSource[];
  coverage: number;
  sourcesUsed: string[];
};

/**
 * Multi-source 7d/30d backfill for set insight + movers.
 * 1) PGT US (comps + price ticks — no third-party quota)
 * 2) PokeTrace US (when not rate-limited)
 * 3) JustTCG US statistics (when key set and gaps remain)
 */
export async function hydrateSetMomentum(
  cards: SetInsightCardSource[],
  options?: { limit?: number; delayMs?: number },
): Promise<SetInsightCardSource[]> {
  if (cards.length === 0) return cards;

  let out = cards;

  if (isSupabaseConfigured()) {
    out = await hydrateSetPgtUsTrends(out);
  }

  if (setMomentumCoverage(out) >= 0.12) return out;

  if (isPokeTraceConfigured() && !isPokeTraceRateLimited()) {
    out = await hydratePokeTraceBatch(out, options);
  }

  if (setMomentumCoverage(out) < 0.12 && isJustTcgConfigured()) {
    out = await hydrateSetMomentumFromJustTcg(out, {
      limit: options?.limit ?? 40,
      delayMs: options?.delayMs,
    });
  }

  return out;
}

/** @deprecated Use hydrateSetMomentum — kept for existing imports. */
export async function hydrateSetUsMomentum(
  cards: SetInsightCardSource[],
  options?: { limit?: number; delayMs?: number },
): Promise<SetInsightCardSource[]> {
  return hydrateSetMomentum(cards, options);
}

export function momentumBackfillStatusMessage(): string | null {
  if (pokeTraceRateLimitMessage()) {
    return (
      pokeTraceRateLimitMessage() +
      (isJustTcgConfigured()
        ? " PGT US trends and JustTCG still apply; live PokeTrace pauses until reset."
        : " PGT US trends and catalog Cardmarket still apply until reset.")
    );
  }
  return null;
}
