import { NextRequest, NextResponse } from "next/server";
import { isBrightDataPopHarvestEnabled } from "@/lib/market/brightdata/config";
import type { GraderId } from "@/lib/market/brightdata/grader-pop-urls";
import {
  harvestGraderPopByCert,
  harvestGraderPopForCatalogCard,
} from "@/lib/pgt-registry/grader-pop-ingest";

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

function parseGrader(raw: string | null): GraderId | null {
  const g = (raw ?? "PSA").trim().toUpperCase();
  if (g === "PSA" || g === "BGS" || g === "CGC") return g;
  return null;
}

/**
 * Bright Data population harvest → `pgt_population_snapshots`.
 *
 * GET /api/jobs/population-harvest?secret=CRON_SECRET&catalogId=base1-4
 * GET /api/jobs/population-harvest?secret=...&cert=12345678&grader=PSA&catalogId=base1-4
 * Optional: &graders=PSA,BGS,CGC · &psaSpecId=306946
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isBrightDataPopHarvestEnabled()) {
    return NextResponse.json(
      {
        ok: false,
        error: "brightdata_not_configured",
        hint:
          "Set BRIGHTDATA_API_KEY plus BRIGHTDATA_CRAWL_DATASET_ID (Crawl API) or BRIGHTDATA_WEB_UNLOCKER_ZONE (Web Unlocker).",
      },
      { status: 503 },
    );
  }

  const catalogId = req.nextUrl.searchParams.get("catalogId")?.trim() || null;
  const cert = req.nextUrl.searchParams.get("cert")?.trim() || null;
  const grader = parseGrader(req.nextUrl.searchParams.get("grader"));
  const psaSpecId = req.nextUrl.searchParams.get("psaSpecId")?.trim() || null;

  if (cert) {
    if (!grader) {
      return NextResponse.json({ ok: false, error: "invalid_grader" }, { status: 400 });
    }
    const result = await harvestGraderPopByCert({
      grader,
      certNumber: cert,
      catalogId,
    });
    return NextResponse.json({
      ok: result.ok,
      mode: "cert",
      result,
      syncedAt: new Date().toISOString(),
    });
  }

  if (!catalogId) {
    return NextResponse.json(
      { ok: false, error: "missing_catalogId_or_cert" },
      { status: 400 },
    );
  }

  const gradersParam = req.nextUrl.searchParams.get("graders")?.trim();
  const graders = gradersParam
    ? (gradersParam
        .split(",")
        .map((g) => parseGrader(g))
        .filter((g): g is GraderId => g != null) as GraderId[])
    : undefined;

  const results = await harvestGraderPopForCatalogCard(catalogId, {
    graders,
    psaSpecId: psaSpecId ? Number(psaSpecId) || psaSpecId : null,
  });

  const gradesWritten = results.reduce((n, r) => n + r.gradesWritten, 0);

  return NextResponse.json({
    ok: results.some((r) => r.ok),
    mode: "catalog",
    catalogId,
    gradesWritten,
    results,
    syncedAt: new Date().toISOString(),
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
