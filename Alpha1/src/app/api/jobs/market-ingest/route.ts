import { NextRequest, NextResponse } from "next/server";
import {
  getMarketNightlyConcurrency,
  getMarketNightlyMaxCards,
  getMarketNightlyTimeBudgetMs,
} from "@/lib/ai/env";
import { ingestCatalogMarketIntel } from "@/lib/pgt-registry/catalog-intel-ingest";
import { executeNightlySetMarketIngest } from "@/lib/pgt-registry/market-ingest-job";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization")?.trim();
  if (auth === `Bearer ${secret}`) return true;
  const q = req.nextUrl.searchParams.get("secret")?.trim();
  return q === secret;
}

/**
 * Nightly institutional market memory — one Pokémon set at a time (vintage → modern).
 *
 * GET /api/jobs/market-ingest?secret=CRON_SECRET
 * Optional: &catalogId=neo2-9 · &setCode=base1 · &maxCards=120
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const singleId = req.nextUrl.searchParams.get("catalogId")?.trim();
  if (singleId) {
    const result = await ingestCatalogMarketIntel(singleId, { profile: "full" });
    return NextResponse.json({
      ok: result.ok,
      processed: 1,
      results: [result],
      syncedAt: new Date().toISOString(),
    });
  }

  const setCodeOverride = req.nextUrl.searchParams.get("setCode")?.trim() || null;
  const maxCards = Math.min(
    250,
    Math.max(20, Number(req.nextUrl.searchParams.get("maxCards") ?? getMarketNightlyMaxCards()) || getMarketNightlyMaxCards()),
  );
  const concurrency = Math.min(
    8,
    Math.max(1, Number(req.nextUrl.searchParams.get("concurrency") ?? getMarketNightlyConcurrency()) || getMarketNightlyConcurrency()),
  );
  const timeBudgetMs = Math.min(
    295_000,
    Math.max(60_000, Number(req.nextUrl.searchParams.get("timeBudgetMs") ?? getMarketNightlyTimeBudgetMs()) || getMarketNightlyTimeBudgetMs()),
  );

  const { plan, batch, cursor } = await executeNightlySetMarketIngest({
    maxCards,
    setCodeOverride,
    concurrency,
    timeBudgetMs,
  });

  if (!plan || !batch) {
    return NextResponse.json({
      ok: false,
      error: "no_catalog_sets",
      syncedAt: new Date().toISOString(),
    });
  }

  return NextResponse.json({
    ok: batch.failed === 0,
    mode: "set_nightly",
    set: {
      code: plan.setCode,
      name: plan.setName,
      releaseDate: plan.releaseDate,
      setIndex: plan.setIndex,
      cardOffset: plan.cardOffset,
      totalCardsInSet: plan.totalCardsInSet,
      setCompleteAfterRun: plan.setCompleteAfterRun,
    },
    processed: batch.processed,
    okCount: batch.ok,
    failed: batch.failed,
    stoppedReason: batch.stoppedReason,
    elapsedMs: batch.elapsedMs,
    nextCursor: cursor,
    maxCards,
    concurrency,
    results: batch.results.slice(0, 40),
    syncedAt: new Date().toISOString(),
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
