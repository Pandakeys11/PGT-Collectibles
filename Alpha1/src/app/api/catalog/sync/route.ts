import { NextRequest, NextResponse } from "next/server";
import { runIncrementalCatalogSync } from "@/lib/catalog/sync/incremental-sync";

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
 * Incremental catalog sync (new/recent sets + cards).
 * Vercel Cron: Authorization Bearer CRON_SECRET
 * Local: GET /api/catalog/sync?secret=YOUR_CRON_SECRET
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runIncrementalCatalogSync();
    return NextResponse.json({
      ok: result.ok,
      syncedAt: new Date().toISOString(),
      results: result.results,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sync failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
