import { buildCatalogSetInsight } from "@/lib/catalog/build-catalog-set-insight";
import { syncSetCatalogPricesFromTcgApi } from "@/lib/catalog/catalog-set-price-sync";
import { persistSetInsight } from "@/lib/catalog/set-insight-persist";
import { loadPokemonSetsVintageFirst } from "@/lib/pgt-registry/market-ingest-set-queue";

export type SetInsightNightlyResult = {
  setId: string;
  setName: string;
  prices: Awaited<ReturnType<typeof syncSetCatalogPricesFromTcgApi>>;
  insightReady: boolean;
  error?: string;
};

/** Price sync + full set insight rebuild for one set. */
export async function rebuildSetInsightForSet(
  setId: string,
  options?: { refreshAi?: boolean; skipPriceSync?: boolean },
): Promise<SetInsightNightlyResult> {
  const setName = setId;
  try {
    const prices = options?.skipPriceSync
      ? {
          setId,
          cardCount: 0,
          pricesUpdated: 0,
          referenceComps: 0,
          pricedPct: 0,
        }
      : await syncSetCatalogPricesFromTcgApi(setId);

    const body = await buildCatalogSetInsight(setId, {
      refreshAi: options?.refreshAi ?? false,
    });

    if (body.ready) {
      await persistSetInsight(body);
    }

    return {
      setId,
      setName: body.setName ?? setName,
      prices,
      insightReady: body.ready,
    };
  } catch (e) {
    return {
      setId,
      setName,
      prices: {
        setId,
        cardCount: 0,
        pricesUpdated: 0,
        referenceComps: 0,
        pricedPct: 0,
      },
      insightReady: false,
      error: e instanceof Error ? e.message : "set_insight_failed",
    };
  }
}

/**
 * Nightly set insight refresh — prioritizes sets with low TCG price coverage.
 * Runs after catalog sync / market ingest when time budget allows.
 */
export async function executeNightlySetInsightRefresh(options?: {
  setIds?: string[];
  maxSets?: number;
  refreshAi?: boolean;
}): Promise<{
  processed: number;
  ready: number;
  results: SetInsightNightlyResult[];
}> {
  const maxSets = Math.min(6, Math.max(1, options?.maxSets ?? 2));
  let targets = options?.setIds?.filter(Boolean) ?? [];

  if (!targets.length) {
    const sets = await loadPokemonSetsVintageFirst();
    targets = sets
      .slice(-maxSets * 3)
      .reverse()
      .slice(0, maxSets * 2)
      .map((s) => s.setCode);
  }

  targets = targets.slice(0, maxSets);
  const results: SetInsightNightlyResult[] = [];
  let ready = 0;

  for (const setId of targets) {
    const row = await rebuildSetInsightForSet(setId, {
      refreshAi: options?.refreshAi ?? false,
    });
    results.push(row);
    if (row.insightReady) ready += 1;
  }

  return { processed: results.length, ready, results };
}
