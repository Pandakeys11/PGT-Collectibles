import {
  SET_INSIGHT_MOVER_SEED_LIMIT,
  SET_INSIGHT_TOP_VALUE_LIMIT,
  SET_INSIGHT_TOP_VALUE_POOL,
} from "@/lib/catalog/set-insight-limits";
import {
  cardInsightRow,
  topMomentumCards,
  topValueCards,
  type SetInsightCardSource,
} from "@/lib/catalog/set-insight-utils";

export type PriorityCardReason = "top_value" | "chase" | "mover";

export type PriorityCatalogCard = {
  catalogId: string;
  name: string;
  reasons: PriorityCardReason[];
  priceUsd: number | null;
  rarity: string | null;
};

export type PrioritySetCardOptions = {
  /** Top FMV slots (default: set insight pool). */
  topValueLimit?: number;
  /** Extra chase picks by rarity/heuristic (priced). */
  chaseLimit?: number;
  /** Cards with existing momentum signal (default: mover seed limit). */
  moverLimit?: number;
  /** Minimum USD for chase rarity picks (filters bulk commons). */
  chaseMinPriceUsd?: number;
};

const CHASE_RARITY_RE =
  /\b(illustration rare|special illustration rare|hyper rare|secret rare|special art rare|double rare|ace spec|ultra rare|shiny rare|rare holo ex|mega ex|special illustration|illustration collection)\b/i;

/** High-end slot / ex line — aligns with set insight “chase” language. */
export function isChaseCandidate(card: SetInsightCardSource): boolean {
  const rarity = (card.rarity ?? "").trim();
  if (!rarity) return false;
  const r = rarity.toLowerCase();
  if (CHASE_RARITY_RE.test(r)) return true;
  const n = card.name.toLowerCase();
  if (/\b(ex|gx|vstar|vmax)\b/.test(n) && /(rare|ultra|hyper|double|secret|illustration)/.test(r)) {
    return true;
  }
  return false;
}

function chaseCards(
  cards: SetInsightCardSource[],
  limit: number,
  minPriceUsd: number,
  exclude: Set<string>,
): PriorityCatalogCard[] {
  const rows = cards
    .filter((c) => !exclude.has(c.id) && isChaseCandidate(c))
    .map((c) => cardInsightRow(c))
    .filter((r) => (r.priceUsd ?? 0) >= minPriceUsd)
    .sort((a, b) => (b.priceUsd ?? 0) - (a.priceUsd ?? 0));

  const out: PriorityCatalogCard[] = [];
  for (const row of rows) {
    if (out.length >= limit) break;
    out.push({
      catalogId: row.catalogId,
      name: row.name,
      reasons: ["chase"],
      priceUsd: row.priceUsd,
      rarity: row.rarity,
    });
    exclude.add(row.catalogId);
  }
  return out;
}

/**
 * Union of top FMV, chase rarity, and momentum seeds — same policy as set insight movers/value rails.
 */
export function selectPrioritySetCards(
  cards: SetInsightCardSource[],
  options?: PrioritySetCardOptions,
): PriorityCatalogCard[] {
  const topValueLimit = options?.topValueLimit ?? SET_INSIGHT_TOP_VALUE_LIMIT;
  const topValuePool = Math.max(topValueLimit, SET_INSIGHT_TOP_VALUE_POOL);
  const chaseLimit = options?.chaseLimit ?? SET_INSIGHT_TOP_VALUE_LIMIT;
  const moverLimit = options?.moverLimit ?? SET_INSIGHT_MOVER_SEED_LIMIT;
  const chaseMinPriceUsd = options?.chaseMinPriceUsd ?? 3;

  const exclude = new Set<string>();
  const byId = new Map<string, PriorityCatalogCard>();

  const add = (entry: PriorityCatalogCard, reason: PriorityCardReason) => {
    const prior = byId.get(entry.catalogId);
    if (prior) {
      if (!prior.reasons.includes(reason)) prior.reasons.push(reason);
      return;
    }
    byId.set(entry.catalogId, { ...entry, reasons: [reason] });
    exclude.add(entry.catalogId);
  };

  for (const row of topValueCards(cards, topValuePool).slice(0, topValueLimit)) {
    add(
      {
        catalogId: row.catalogId,
        name: row.name,
        reasons: ["top_value"],
        priceUsd: row.priceUsd,
        rarity: row.rarity,
      },
      "top_value",
    );
  }

  for (const entry of chaseCards(cards, chaseLimit, chaseMinPriceUsd, exclude)) {
    add(entry, "chase");
  }

  for (const row of topMomentumCards(cards, moverLimit)) {
    if (exclude.has(row.catalogId)) {
      const prior = byId.get(row.catalogId);
      if (prior && !prior.reasons.includes("mover")) prior.reasons.push("mover");
      continue;
    }
    add(
      {
        catalogId: row.catalogId,
        name: row.name,
        reasons: ["mover"],
        priceUsd: row.priceUsd,
        rarity: row.rarity,
      },
      "mover",
    );
  }

  return [...byId.values()].sort((a, b) => (b.priceUsd ?? 0) - (a.priceUsd ?? 0));
}
