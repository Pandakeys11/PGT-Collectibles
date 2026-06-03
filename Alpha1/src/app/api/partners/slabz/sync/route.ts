import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { syncSlabzToMasterCatalog } from "@/lib/slabz/sync-master-catalog";
import { isSlabzPartnerConfigured } from "@/lib/slabz/config";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function cronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const authHeader = req.headers.get("authorization")?.trim();
  if (authHeader === `Bearer ${secret}`) return true;
  return req.nextUrl.searchParams.get("secret")?.trim() === secret;
}

/**
 * Pull Slabz packs + completed transaction slabs into master catalog (`tcg_catalog_*`)
 * and `pgt_slabz_assets`.
 *
 * Auth: `Authorization: Bearer CRON_SECRET` or `?secret=` OR signed-in Clerk user (manual test).
 */
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!cronAuthorized(req) && !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSlabzPartnerConfigured()) {
    return NextResponse.json({ error: "SLABZ_API_KEY not configured" }, { status: 503 });
  }

  const maxRaw = req.nextUrl.searchParams.get("maxTransactions");
  const maxTransactions = maxRaw ? Math.min(2000, Math.max(1, Number(maxRaw))) : 500;

  try {
    const result = await syncSlabzToMasterCatalog({ maxTransactions });
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (err) {
    console.error("[partners/slabz/sync]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
