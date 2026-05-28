import {
  getMarketNightlyConcurrency,
  getMarketNightlyTimeBudgetMs,
} from "@/lib/ai/env";
import {
  ingestCatalogMarketIntel,
  type CatalogIntelIngestResult,
} from "@/lib/pgt-registry/catalog-intel-ingest";

export type MarketIngestBatchResult = {
  processed: number;
  ok: number;
  failed: number;
  stoppedReason: "complete" | "time_budget";
  elapsedMs: number;
  results: Array<CatalogIntelIngestResult & { index: number }>;
};

/** Process catalog cards in parallel until time budget or list ends. */
export async function runMarketIngestBatch(options: {
  catalogIds: string[];
  concurrency?: number;
  timeBudgetMs?: number;
  profile?: "nightly" | "full";
}): Promise<MarketIngestBatchResult> {
  const catalogIds = options.catalogIds.filter(Boolean);
  const concurrency = Math.min(
    8,
    Math.max(1, options.concurrency ?? getMarketNightlyConcurrency()),
  );
  const timeBudgetMs = options.timeBudgetMs ?? getMarketNightlyTimeBudgetMs();
  const profile = options.profile ?? "nightly";
  const deadline = Date.now() + timeBudgetMs;
  const started = Date.now();
  const results: Array<(CatalogIntelIngestResult & { index: number }) | null> = [];
  let nextIndex = 0;
  let stoppedReason: MarketIngestBatchResult["stoppedReason"] = "complete";

  async function runOne(catalogId: string, index: number) {
    if (Date.now() >= deadline) {
      stoppedReason = "time_budget";
      return;
    }
    const result = await ingestCatalogMarketIntel(catalogId, { profile });
    results[index] = { ...result, index };
  }

  async function worker() {
    for (;;) {
      if (Date.now() >= deadline) {
        stoppedReason = "time_budget";
        return;
      }
      const i = nextIndex;
      nextIndex += 1;
      if (i >= catalogIds.length) return;
      await runOne(catalogIds[i]!, i);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, catalogIds.length) }, () => worker()),
  );

  const trimmed = results.filter(
    (r): r is CatalogIntelIngestResult & { index: number } => r != null,
  );
  let ok = 0;
  let failed = 0;
  for (const row of trimmed) {
    if (row.ok) ok += 1;
    else failed += 1;
  }

  if (trimmed.length < catalogIds.length) {
    stoppedReason = "time_budget";
  }

  return {
    processed: trimmed.length,
    ok,
    failed,
    stoppedReason,
    elapsedMs: Date.now() - started,
    results: trimmed,
  };
}
