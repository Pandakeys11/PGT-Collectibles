import type { CatalogIntelIngestResult } from "@/lib/pgt-registry/catalog-intel-ingest";
import { ingestCatalogMarketIntel } from "@/lib/pgt-registry/catalog-intel-ingest";
import {
  buildPokemonMarketKnowledge,
  type PokemonMarketKnowledge,
} from "@/lib/market/pokemon-market-knowledge";

const THIN_COMPS_THRESHOLD = 6;

export type RefreshPokemonMarketResult = {
  knowledge: PokemonMarketKnowledge;
  ingest: CatalogIntelIngestResult | null;
  liveRefreshRan: boolean;
};

/**
 * Stale-while-revalidate: serve cached knowledge immediately; run live ingest when memory is thin.
 */
export async function refreshPokemonMarketKnowledge(
  catalogId: string,
  options?: { force?: boolean },
): Promise<RefreshPokemonMarketResult | null> {
  const id = catalogId.trim();
  if (!id) return null;

  const existing = await buildPokemonMarketKnowledge(id);
  if (!existing?.card) return null;

  const thin =
    !existing.institutionalMemory ||
    existing.dataDepth.persistedComps < THIN_COMPS_THRESHOLD;

  const liveRefreshRan = Boolean(options?.force || thin);
  let ingest: CatalogIntelIngestResult | null = null;

  if (liveRefreshRan) {
    ingest = await ingestCatalogMarketIntel(id, { profile: "full" });
  }

  const knowledge = (await buildPokemonMarketKnowledge(id)) ?? existing;
  return { knowledge, ingest, liveRefreshRan };
}
