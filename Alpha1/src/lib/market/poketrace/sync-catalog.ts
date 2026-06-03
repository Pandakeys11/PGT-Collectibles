import { getCardFromDb } from "@/lib/catalog/db-catalog-browse";
import { upsertCatalogCards } from "@/lib/catalog/db-catalog";
import { parseCatalogPriceSnapshot } from "@/lib/market/catalog-reference-evidence";
import { isPokeTraceConfigured } from "@/lib/market/env-market";
import { buildPokeTraceCatalogSnapshot } from "@/lib/market/poketrace/build-catalog-snapshot";
import { collectPokeTraceMarketEvidence } from "@/lib/market/poketrace/collect";
import { catalogSummaryToExtractedCard } from "@/lib/market/pokemon-market-knowledge-shared";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

/** Upsert catalog `prices_json` from PokeTrace (24/7 pipeline source). */
export async function refreshPokeTraceCatalogPrices(catalogId: string): Promise<boolean> {
  if (!isPokeTraceConfigured() || !isSupabaseConfigured()) return false;

  const id = catalogId.trim();
  if (!id) return false;

  const catalogCard = await getCardFromDb("pokemon", id);
  if (!catalogCard) return false;

  const snapshot = await buildPokeTraceCatalogSnapshot(id);
  if (!snapshot?.pokeTrace?.cardId) return false;

  const rawJson = {
    pokeTraceCardId: snapshot.pokeTrace.cardId,
    pokeTraceSyncedAt: snapshot.pokeTrace.syncedAt ?? new Date().toISOString(),
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
