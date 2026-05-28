import { getMarketNightlyMaxCards } from "@/lib/ai/env";
import { runMarketIngestBatch } from "@/lib/pgt-registry/market-ingest-runner";
import {
  planNightlySetIngest,
  readSetIngestCursor,
  resolveCursorAfterBatch,
  writeSetIngestCursor,
  type NightlySetIngestPlan,
} from "@/lib/pgt-registry/market-ingest-set-queue";

export type NightlySetMarketIngestResult = {
  plan: NightlySetIngestPlan | null;
  batch: Awaited<ReturnType<typeof runMarketIngestBatch>> | null;
  cursor: Awaited<ReturnType<typeof readSetIngestCursor>>;
};

export async function executeNightlySetMarketIngest(options?: {
  maxCards?: number;
  setCodeOverride?: string | null;
  concurrency?: number;
  timeBudgetMs?: number;
}): Promise<NightlySetMarketIngestResult> {
  const maxCards = options?.maxCards ?? getMarketNightlyMaxCards();
  const cursor = await readSetIngestCursor();
  const plan = await planNightlySetIngest({
    maxCards,
    setCodeOverride: options?.setCodeOverride,
    cursor,
  });

  if (!plan) {
    return { plan: null, batch: null, cursor };
  }

  if (plan.catalogIds.length === 0) {
    await writeSetIngestCursor(plan.nextCursor);
    return {
      plan,
      batch: {
        processed: 0,
        ok: 0,
        failed: 0,
        stoppedReason: "complete",
        elapsedMs: 0,
        results: [],
      },
      cursor: plan.nextCursor,
    };
  }

  const batch = await runMarketIngestBatch({
    catalogIds: plan.catalogIds,
    concurrency: options?.concurrency,
    timeBudgetMs: options?.timeBudgetMs,
    profile: "nightly",
  });

  const nextCursor = resolveCursorAfterBatch(plan, batch.processed);
  await writeSetIngestCursor(nextCursor);

  return { plan, batch, cursor: nextCursor };
}
