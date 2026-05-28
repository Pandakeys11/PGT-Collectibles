import { NextRequest, NextResponse } from "next/server";
import { buildWeeklyMovers } from "@/lib/market/build-weekly-movers";
import { registerRuntimeCacheClear } from "@/lib/server/runtime-caches";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

const CACHE_TTL_MS = 20 * 60 * 1000;
let cache: { at: number; body: Awaited<ReturnType<typeof buildWeeklyMovers>> } | null = null;
let buildInFlight: Promise<Awaited<ReturnType<typeof buildWeeklyMovers>>> | null = null;

registerRuntimeCacheClear(() => {
  cache = null;
  buildInFlight = null;
});

async function ensureBuilt(refresh: boolean) {
  if (!refresh && cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.body;
  }
  if (buildInFlight) return buildInFlight;
  buildInFlight = buildWeeklyMovers()
    .then((body) => {
      if (body.ready) cache = { at: Date.now(), body };
      return body;
    })
    .finally(() => {
      buildInFlight = null;
    });
  return buildInFlight;
}

export async function GET(req: NextRequest) {
  const refresh = new URL(req.url).searchParams.get("refresh") === "1";
  const body = await ensureBuilt(refresh);
  return NextResponse.json(body);
}
