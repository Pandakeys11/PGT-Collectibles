import { NextRequest, NextResponse } from "next/server";
import {
  ensureMarketDailyBrief,
  getCachedMarketDailyBrief,
} from "@/lib/market/market-daily-brief-cache";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const refresh = new URL(req.url).searchParams.get("refresh") === "1";
  const cached = getCachedMarketDailyBrief();

  if (!refresh && cached) {
    return NextResponse.json(cached);
  }

  if (refresh && cached) {
    void ensureMarketDailyBrief(true);
    return NextResponse.json(cached);
  }

  const body = await ensureMarketDailyBrief(refresh);
  return NextResponse.json(body);
}
