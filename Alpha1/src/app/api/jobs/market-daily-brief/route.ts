import { NextRequest, NextResponse } from "next/server";
import { ensureMarketDailyBrief } from "@/lib/market/market-daily-brief-cache";
import {
  getMarketDailyBriefEditionKey,
  marketDailyBriefScheduleLabel,
} from "@/lib/market/market-daily-brief-schedule";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization")?.trim();
  if (auth === `Bearer ${secret}`) return true;
  return req.nextUrl.searchParams.get("secret")?.trim() === secret;
}

/**
 * Pre-build the idle Market Intelligence daily TCG desk.
 * Scheduled after nightly-final so catalog + FMV anchors are fresh.
 *
 * GET /api/jobs/market-daily-brief
 * Local: npm run market:daily-brief
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await ensureMarketDailyBrief(true);

  return NextResponse.json({
    ok: body.ready,
    editionKey: getMarketDailyBriefEditionKey(),
    scheduleLabel: marketDailyBriefScheduleLabel(),
    brief: body,
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
