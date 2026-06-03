import {
  cardInsightRow,
  pricesForInsightCard,
  type SetInsightCardSource,
} from "@/lib/catalog/set-insight-utils";
import { extractTcgPlayerProductId } from "@/lib/market/justtcg/price-snapshot";
import { justTcgBatchLookupCards, justTcgGetCards } from "@/lib/market/justtcg/client";
import { matchJustTcgCardToRow, priceSnapshotFromJustTcgCard } from "@/lib/market/justtcg/price-snapshot";
import type { JustTcgBatchLookupItem } from "@/lib/market/justtcg/types";
import { isJustTcgConfigured } from "@/lib/market/env-market";
import { resolvedCatalogMomentumPct } from "@/lib/market/catalog-momentum";
import type { CatalogCardSummary } from "@/lib/catalog/catalog-types";
import type { CatalogPriceSnapshot } from "@/lib/market/pokemon-catalog";
import type { TcgCardSummary } from "@/lib/pokedex/tcg-api-types";

function needsMomentumBackfill(card: SetInsightCardSource): boolean {
  return resolvedCatalogMomentumPct(pricesForInsightCard(card)) == null;
}

function batchItemForCard(card: SetInsightCardSource): JustTcgBatchLookupItem | null {
  const prices = pricesForInsightCard(card);
  const tcgId = extractTcgPlayerProductId(prices.tcgPlayerUrl);
  if (tcgId) {
    return { tcgplayerId: tcgId, game: "pokemon" };
  }
  if ("tcgplayer" in card && card.tcgplayer?.url) {
    const fromEmbed = extractTcgPlayerProductId(card.tcgplayer.url);
    if (fromEmbed) return { tcgplayerId: fromEmbed, game: "pokemon" };
  }
  const set = card.set?.name ?? card.set?.id ?? "";
  const number = (card.number ?? "").replace(/^#/, "").trim();
  if (!card.name.trim()) return null;
  return {
    game: "pokemon",
    set: set || undefined,
    number: number || undefined,
    query: card.name.trim().slice(0, 80),
  };
}

async function resolveJustTcgCard(
  card: SetInsightCardSource,
  batchHits: import("@/lib/market/justtcg/types").JustTcgCard[],
): Promise<import("@/lib/market/justtcg/types").JustTcgCard | null> {
  const row = {
    name: card.name,
    card_number: card.number,
    prices_json: pricesForInsightCard(card) as unknown as Record<string, unknown>,
  };
  const fromBatch = matchJustTcgCardToRow(row, batchHits);
  if (fromBatch) return fromBatch;

  const item = batchItemForCard(card);
  if (!item) return null;

  const { cards: singles } = await justTcgGetCards({
    game: "pokemon",
    search: card.name.trim().slice(0, 80),
    limit: 12,
  });
  const hit = matchJustTcgCardToRow(row, singles);
  if (hit) return hit;

  if (item.tcgplayerId) {
    const { cards: byId } = await justTcgGetCards({
      game: "pokemon",
      tcgplayerId: item.tcgplayerId,
      limit: 3,
    });
    return matchJustTcgCardToRow(row, byId) ?? byId[0] ?? null;
  }

  return null;
}

function applySnapshotToCard(
  card: SetInsightCardSource,
  snap: CatalogPriceSnapshot,
): SetInsightCardSource {
  if ("prices" in card) {
    return { ...card, prices: snap } satisfies CatalogCardSummary;
  }
  const tcg = snap.tcgPlayerPrices.length
    ? {
        url: snap.tcgPlayerUrl ?? undefined,
        updatedAt: snap.tcgPlayerUpdatedAt ?? undefined,
        prices: Object.fromEntries(
          snap.tcgPlayerPrices.map((r) => [
            r.variant,
            {
              market: r.market ?? undefined,
              mid: r.mid ?? undefined,
              low: r.low ?? undefined,
              high: r.high ?? undefined,
            },
          ]),
        ),
      }
    : (card as TcgCardSummary).tcgplayer;

  return {
    ...(card as TcgCardSummary),
    catalogPrices: snap,
    tcgplayer: tcg,
  } satisfies TcgCardSummary;
}

/**
 * Backfill 7d/30d momentum via JustTCG batch API (up to 20 cards per request).
 * Runs when PokeTrace is rate-limited or missing US windows.
 */
export async function hydrateSetMomentumFromJustTcg(
  cards: SetInsightCardSource[],
  options?: { limit?: number; batchSize?: number; delayMs?: number },
): Promise<SetInsightCardSource[]> {
  if (!isJustTcgConfigured() || cards.length === 0) return cards;

  const limit = options?.limit ?? 40;
  const batchSize = Math.min(
    20,
    options?.batchSize ?? (Number(process.env.JUSTTCG_BATCH_SIZE) || 20),
  );
  const delayMs = options?.delayMs ?? (Number(process.env.JUSTTCG_SYNC_DELAY_MS) || 450);

  const targets = cards
    .filter(needsMomentumBackfill)
    .sort((a, b) => (cardInsightRow(b).priceUsd ?? 0) - (cardInsightRow(a).priceUsd ?? 0))
    .slice(0, limit);

  if (!targets.length) return cards;

  const byId = new Map(cards.map((c) => [c.id, c]));

  for (let i = 0; i < targets.length; i += batchSize) {
    const chunk = targets.slice(i, i + batchSize);
    const items: JustTcgBatchLookupItem[] = [];

    for (const card of chunk) {
      const item = batchItemForCard(card);
      if (item) items.push(item);
    }

    if (!items.length) continue;

    try {
      const { cards: hits, error } = await justTcgBatchLookupCards(items);
      if (error?.includes("rate") || error?.includes("limit")) break;

      for (const card of chunk) {
        const hit = await resolveJustTcgCard(card, hits);
        if (!hit) continue;
        const prior = pricesForInsightCard(card);
        const snap = priceSnapshotFromJustTcgCard(hit, prior);
        if (resolvedCatalogMomentumPct(snap) == null) continue;
        byId.set(card.id, applySnapshotToCard(card, snap));
      }
    } catch {
      /* next batch */
    }

    if (delayMs > 0 && i + batchSize < targets.length) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return cards.map((c) => byId.get(c.id) ?? c);
}
