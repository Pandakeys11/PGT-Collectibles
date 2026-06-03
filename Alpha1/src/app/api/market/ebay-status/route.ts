import { NextResponse } from "next/server";
import { getEbayBrowseConfigStatus } from "@/lib/market/env-market";

export const dynamic = "force-dynamic";

/** Lightweight check — whether this server instance has eBay Browse OAuth env vars. */
export async function GET() {
  const status = getEbayBrowseConfigStatus();
  return NextResponse.json({
    configured: status.configured,
    apiEnv: status.apiEnv,
    hasClientId: status.hasClientId,
    hasClientSecret: status.hasClientSecret,
    hint: status.hint || null,
  });
}
