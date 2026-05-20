import type { TcgCardSummary } from "@/lib/pokedex/tcg-api-types";

export const LEGENDARY_COLLECTION_SET_ID = "base6";

export function isLegendaryCollectionCatalogExpand(setId: string): boolean {
  return setId.trim() === LEGENDARY_COLLECTION_SET_ID;
}

function collectorOrder(n: string): number {
  const t = n.trim().replace(/^0+(?=\d)/, "") || "0";
  const v = Number.parseInt(t, 10);
  return Number.isFinite(v) ? v : 9999;
}

/**
 * Legendary Collection: one API row per number; add a synthetic reverse-holo row for each (same CDN art).
 */
export function expandLegendaryCollectionRows(cards: TcgCardSummary[]): TcgCardSummary[] {
  const out: TcgCardSummary[] = [];
  for (const c of cards) {
    const row: TcgCardSummary = { ...c };
    delete row.catalogFinish;
    out.push(row);
    out.push({ ...c, catalogFinish: "reverse_holo" });
  }
  out.sort((a, b) => {
    const cmp = collectorOrder(a.number) - collectorOrder(b.number);
    if (cmp !== 0) return cmp;
    return a.catalogFinish === "reverse_holo" ? 1 : 0;
  });
  return out;
}
