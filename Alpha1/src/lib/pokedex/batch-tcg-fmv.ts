import {
  attachRawFmvToTcgCardsFast,
} from "@/lib/market/catalog-set-fmv";
import {
  hydrateTcgCardSummariesWithLivePrices,
  tcgSummaryHasFmv,
} from "@/lib/pokedex/tcg-price-hydrate";
import type { TcgCardSummary } from "@/lib/pokedex/tcg-api-types";

function cardNeedsFmvHydration(card: TcgCardSummary): boolean {
  if (card.rawFmvUsd != null) return false;
  return !tcgSummaryHasFmv(card);
}

/** Live TCGPlayer prices + fast Raw FMV for a batch of grid cards. */
export async function batchHydrateTcgCardFmv(
  setId: string,
  cards: TcgCardSummary[],
): Promise<TcgCardSummary[]> {
  if (!cards.length) return cards;

  const needs = cards.filter(cardNeedsFmvHydration);
  if (!needs.length) return attachRawFmvToTcgCardsFast(cards);

  let working = [...cards];
  try {
    working = await hydrateTcgCardSummariesWithLivePrices(setId, working);
  } catch {
    /* keep rows */
  }

  return attachRawFmvToTcgCardsFast(working);
}
