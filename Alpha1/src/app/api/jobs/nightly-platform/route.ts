import { NextRequest, NextResponse } from "next/server";
import {
  getMarketNightlyConcurrency,
  getMarketNightlyMaxCards,
  getMarketNightlyTimeBudgetMs,
} from "@/lib/ai/env";
import { runIncrementalCatalogSync } from "@/lib/catalog/sync/incremental-sync";
import { rebuildSetInsightForSet } from "@/lib/catalog/set-insight-nightly";
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
 * Nightly platform: incremental catalog sync + full-set market memory (vintage → modern).
 *
 * Vercel Cron (Authorization: Bearer CRON_SECRET):
 *   GET /api/jobs/nightly-platform
 *
 * Local:
 *   npm run platform:nightly
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const maxCards = Math.min(
    250,
    Math.max(20, Number(req.nextUrl.searchParams.get("maxCards") ?? getMarketNightlyMaxCards()) || getMarketNightlyMaxCards()),
  );
  const skipCatalog = req.nextUrl.searchParams.get("skipCatalog") === "1";
  const skipMarket = req.nextUrl.searchParams.get("skipMarket") === "1";
  const setCodeOverride = req.nextUrl.searchParams.get("setCode")?.trim() || null;

  const startedAt = new Date().toISOString();
  const out: Record<string, unknown> = {
    startedAt,
    catalog: { ok: true, skipped: skipCatalog },
    market: { skipped: skipMarket },
  };

  if (!skipCatalog) {
    try {
      const catalog = await runIncrementalCatalogSync();
      out.catalog = { ok: catalog.ok, results: catalog.results };
    } catch (e) {
      out.catalog = {
        ok: false,
        results: [{ error: e instanceof Error ? e.message : "catalog_sync_failed" }],
      };
    }
  }

  if (!skipMarket) {
    const { plan, batch, cursor } = await executeNightlySetMarketIngest({
      maxCards,
      setCodeOverride,
      concurrency: getMarketNightlyConcurrency(),
      timeBudgetMs: getMarketNightlyTimeBudgetMs(),
    });
    out.market = {
      mode: "set_nightly",
      plan: plan
        ? {
            setCode: plan.setCode,
            setName: plan.setName,
            releaseDate: plan.releaseDate,
            setIndex: plan.setIndex,
            cardOffset: plan.cardOffset,
            totalCardsInSet: plan.totalCardsInSet,
            queued: plan.catalogIds.length,
            setCompleteAfterRun: plan.setCompleteAfterRun,
          }
        : null,
      batch,
      nextCursor: cursor,
      maxCards,
    };

    if (plan?.setCompleteAfterRun && plan.setCode) {
      try {
        const setInsight = await rebuildSetInsightForSet(plan.setCode, {
          refreshAi: false,
        });
        (out.market as Record<string, unknown>).setInsight = setInsight;
      } catch (e) {
        (out.market as Record<string, unknown>).setInsight = {
          setId: plan.setCode,
          insightReady: false,
          error: e instanceof Error ? e.message : "set_insight_failed",
        };
      }
    }
  }

  const catalogOk = (out.catalog as { ok?: boolean })?.ok !== false;
  const batchFailed = (out.market as { batch?: { failed?: number } })?.batch?.failed ?? 0;

  return NextResponse.json({
    ok: catalogOk && batchFailed === 0,
    finishedAt: new Date().toISOString(),
    ...out,
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
