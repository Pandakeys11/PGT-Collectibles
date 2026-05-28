import {
  cardInsightRow,
  catalogMomentumPct,
  type SetInsightCardSource,
} from "@/lib/catalog/set-insight-utils";

export type CatalogCardSortId = "number" | "price_desc" | "price_asc" | "momentum";

export const CATALOG_CARD_SORT_OPTIONS: { id: CatalogCardSortId; label: string }[] = [
  { id: "number", label: "Card #" },
  { id: "price_desc", label: "Price ↓" },
  { id: "price_asc", label: "Price ↑" },
  { id: "momentum", label: "7d move" },
];

function collectorNumberKey(number: string | null | undefined): number {
  const raw = (number ?? "").replace(/^#/, "").trim();
  const primary = (raw.split("/")[0] ?? raw).replace(/\D/g, "");
  const n = Number.parseInt(primary, 10);
  return Number.isFinite(n) ? n : 9999;
}

export function sortCatalogCards<T extends SetInsightCardSource>(
  cards: T[],
  sortBy: CatalogCardSortId,
): T[] {
  if (sortBy === "number" || cards.length < 2) {
    return [...cards].sort(
      (a, b) => collectorNumberKey(a.number) - collectorNumberKey(b.number),
    );
  }

  const scored = cards.map((card) => {
    const row = cardInsightRow(card);
    return { card, row };
  });

  if (sortBy === "momentum") {
    return scored
      .sort(
        (a, b) =>
          Math.abs(b.row.momentumPct ?? 0) - Math.abs(a.row.momentumPct ?? 0),
      )
      .map((s) => s.card);
  }

  if (sortBy === "price_asc") {
    return scored
      .sort((a, b) => (a.row.priceUsd ?? -1) - (b.row.priceUsd ?? -1))
      .map((s) => s.card);
  }

  return scored
    .sort((a, b) => (b.row.priceUsd ?? -1) - (a.row.priceUsd ?? -1))
    .map((s) => s.card);
}

export function momentumPctForCard(card: SetInsightCardSource): number | null {
  if ("prices" in card && card.prices) return catalogMomentumPct(card.prices);
  return cardInsightRow(card).momentumPct;
}
