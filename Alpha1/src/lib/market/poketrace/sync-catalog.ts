import { getCardFromDb } from "@/lib/catalog/db-catalog-browse";
import { upsertCatalogCards } from "@/lib/catalog/db-catalog";
import { parseCatalogPriceSnapshot } from "@/lib/market/catalog-reference-evidence";
import { isPokeTraceConfigured } from "@/lib/market/env-market";
import { collectPokeTraceMarketEvidence } from "@/lib/market/poketrace/collect";
import { fetchPokeTracePriceHistory } from "@/lib/market/poketrace/history";
import {
  fetchPokeTraceCardById,
  searchPokeTraceCards,
  scoreCardMatch,
} from "@/lib/market/poketrace/match";
import { buildCatalogSnapshotFromPokeTrace } from "@/lib/market/poketrace/snapshot";
import { marketForCard, pickPrimaryTierRow } from "@/lib/market/poketrace/tiers";
import type { PokeTraceCard } from "@/lib/market/poketrace/types";
import { catalogSummaryToExtractedCard } from "@/lib/market/pokemon-market-knowledge-shared";
import type { CatalogCardSummary } from "@/lib/catalog/catalog-types";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

async function resolvePokeTraceCard(
  catalogCard: CatalogCardSummary,
  extracted = catalogSummaryToExtractedCard(catalogCard),
): Promise<PokeTraceCard | null> {
  const stored = parseCatalogPriceSnapshot(catalogCard.prices ?? null).pokeTrace?.cardId ?? null;
  if (stored) {
    const byId = await fetchPokeTraceCardById(stored);
    if (byId) return byId;
  }

  const candidates = await searchPokeTraceCards(extracted);
  const ranked = candidates
    .map((c) => ({ c, score: scoreCardMatch(c, extracted) }))
    .sort((a, b) => b.score - a.score);
  if (!ranked[0]?.c || (ranked[0]?.score ?? 0) < 4) return null;
  return ranked[0].c;
}

/** Upsert catalog `prices_json` from PokeTrace (24/7 pipeline source). */
export async function refreshPokeTraceCatalogPrices(catalogId: string): Promise<boolean> {
  if (!isPokeTraceConfigured() || !isSupabaseConfigured()) return false;

  const id = catalogId.trim();
  if (!id) return false;

  const catalogCard = await getCardFromDb("pokemon", id);
  if (!catalogCard) return false;

  const extracted = catalogSummaryToExtractedCard(catalogCard);
  const pokeCard = await resolvePokeTraceCard(catalogCard, extracted);
  if (!pokeCard) return false;

  const primary = pickPrimaryTierRow(extracted, pokeCard);
  let historyPoints = 0;
  if (primary) {
    const history = await fetchPokeTracePriceHistory(pokeCard.id, primary.tier, {
      period: "90d",
      limit: 14,
    });
    historyPoints = history.length;
  }

  const existing = parseCatalogPriceSnapshot(catalogCard.prices ?? null);
  const { snapshot } = buildCatalogSnapshotFromPokeTrace(pokeCard, extracted, {
    existing,
    historyPoints,
    market: marketForCard(extracted),
  });

  const rawJson = {
    pokeTraceCardId: pokeCard.id,
    pokeTraceSyncedAt: snapshot.pokeTrace?.syncedAt ?? new Date().toISOString(),
  };

  await upsertCatalogCards([
    {
      franchise: "pokemon",
      catalogId: id,
      name: catalogCard.name,
      printedName: catalogCard.name,
      setName: catalogCard.set?.name ?? null,
      setCode: catalogCard.set?.code ?? null,
      cardNumber: catalogCard.number,
      year: catalogCard.set?.releaseDate?.slice(0, 4) ?? null,
      rarity: catalogCard.rarity,
      imageSmallUrl: catalogCard.images?.small ?? null,
      imageLargeUrl: catalogCard.images?.large ?? null,
      pricesJson: snapshot as unknown as Record<string, unknown>,
      rawJson,
      sourceId: "poketrace",
    },
  ]);

  return true;
}

/** Returns true when PokeTrace produced enough rows to skip redundant TCG API refresh. */
export function pokeTraceCoversTcgPrices(evidenceCount: number): boolean {
  return evidenceCount >= 4;
}

export async function syncPokeTraceForCatalogIngest(catalogId: string): Promise<{
  pricesRefreshed: boolean;
  evidenceCount: number;
  pokeTraceCardId: string | null;
}> {
  const refreshed = await refreshPokeTraceCatalogPrices(catalogId);
  const catalogCard = await getCardFromDb("pokemon", catalogId);
  if (!catalogCard) {
    return { pricesRefreshed: false, evidenceCount: 0, pokeTraceCardId: null };
  }

  const extracted = catalogSummaryToExtractedCard(catalogCard);
  const storedId =
    parseCatalogPriceSnapshot(catalogCard.prices ?? null).pokeTrace?.cardId ?? null;
  const result = await collectPokeTraceMarketEvidence(extracted, {
    pokeTraceId: storedId,
  });

  return {
    pricesRefreshed: refreshed,
    evidenceCount: result.evidence.length,
    pokeTraceCardId: storedId,
  };
}
