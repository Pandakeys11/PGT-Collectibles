import type { CatalogCardSummary } from "@/lib/catalog/catalog-types";
import {
  catalogRawFmvToFairValueBasis,
  resolveCatalogRawFmvForCard,
} from "@/lib/market/catalog-raw-fmv";
import type { CatalogRawFmvSeed } from "@/lib/market/fmv-display";
import type { TcgCardSummary } from "@/lib/pokedex/tcg-api-types";

type CardLike = CatalogCardSummary | TcgCardSummary;

function setName(card: CardLike): string | null {
  return card.set?.name ?? null;
}

/** Client-side Raw FMV seed — matches grid ribbons and detail intel. */
export function catalogRawFmvSeedFromCard(card: CardLike): CatalogRawFmvSeed {
  const catalogFinish =
    "catalogFinish" in card && card.catalogFinish === "reverse_holo" ? "reverse_holo" : undefined;

  const overrideUsd = "rawFmvUsd" in card ? card.rawFmvUsd : undefined;
  const overrideSourceLabel = "rawFmvSourceLabel" in card ? card.rawFmvSourceLabel : undefined;

  const fmv = resolveCatalogRawFmvForCard({
    catalogPrices: "prices" in card ? card.prices : undefined,
    tcgplayer: "tcgplayer" in card ? card.tcgplayer : undefined,
    cardmarket: "cardmarket" in card ? card.cardmarket : undefined,
    catalogFinish,
    rarity: card.rarity ?? null,
    identity: {
      name: card.name,
      number: card.number ?? null,
      set: setName(card),
    },
  });

  return {
    rawFmvUsd: overrideUsd != null ? overrideUsd : fmv.usd,
    rawFmvBasis: catalogRawFmvToFairValueBasis(fmv.basis),
    rawFmvSourceLabel: overrideSourceLabel ?? fmv.sourceLabel,
    tcgPlayerUsd: fmv.tcgPlayerUsd,
    priceChartingUsd: fmv.priceChartingUsd,
  };
}
