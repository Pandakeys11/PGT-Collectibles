import { NextRequest, NextResponse } from "next/server";
import { runIncrementalCatalogSync } from "@/lib/catalog/sync/incremental-sync";
import { executeNightlySetInsightRefresh } from "@/lib/catalog/set-insight-nightly";
import {
  buildNightlyPlatformReport,
  persistNightlyPlatformReport,
} from "@/lib/pgt-registry/nightly-platform-report";

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
 * Final nightly run: catalog sync + full platform report (06:10 AM EST / 11:10 UTC).
 *
 * GET /api/jobs/nightly-final
 * Local: npm run platform:nightly:final
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const skipCatalog = req.nextUrl.searchParams.get("skipCatalog") === "1";
  let catalog: { ok: boolean; results?: unknown; error?: string } = { ok: true, results: [] };

  if (!skipCatalog) {
    try {
      const result = await runIncrementalCatalogSync();
      catalog = { ok: result.ok, results: result.results };
    } catch (e) {
      catalog = {
        ok: false,
        error: e instanceof Error ? e.message : "catalog_sync_failed",
      };
    }
  }

  const report = await buildNightlyPlatformReport(catalog.results);
  await persistNightlyPlatformReport(report);

  let setInsight: Awaited<ReturnType<typeof executeNightlySetInsightRefresh>> | null = null;
  if (req.nextUrl.searchParams.get("skipSetInsight") !== "1") {
    const cursorSet =
      typeof report?.marketIngest?.setCode === "string"
        ? report.marketIngest.setCode
        : null;
    setInsight = await executeNightlySetInsightRefresh({
      setIds: cursorSet ? [cursorSet] : undefined,
      maxSets: Number(req.nextUrl.searchParams.get("setInsightSets") ?? 3) || 3,
      refreshAi: req.nextUrl.searchParams.get("setInsightAi") === "1",
    });
  }

  return NextResponse.json({
    ok: catalog.ok,
    finishedAt: new Date().toISOString(),
    scheduleLabel:
      "06:10 EST (11:10 UTC) — catalog sync + nightly report + set insight refresh",
    catalog,
    report,
    setInsight,
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
