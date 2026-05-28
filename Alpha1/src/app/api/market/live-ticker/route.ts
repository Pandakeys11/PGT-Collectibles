import { NextRequest, NextResponse } from "next/server";
import { buildLiveMarketTicker } from "@/lib/market/build-live-market-ticker";
import { ensurePokeTraceWsBridge } from "@/lib/market/poketrace/ws-bridge";
import { isPokeTraceWsEnabled } from "@/lib/market/env-market";
import type { LiveMarketTickerPayload } from "@/lib/market/live-market-ticker-types";
import { registerRuntimeCacheClear } from "@/lib/server/runtime-caches";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const CACHE_TTL_MS = 25 * 60 * 1000;
let cache: { at: number; body: LiveMarketTickerPayload } | null = null;
let buildInFlight: Promise<LiveMarketTickerPayload> | null = null;

registerRuntimeCacheClear(() => {
  cache = null;
  buildInFlight = null;
});

async function ensureBuilt(refresh: boolean): Promise<LiveMarketTickerPayload> {
  if (!refresh && cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.body;
  }

  if (buildInFlight) return buildInFlight;

  if (isPokeTraceWsEnabled()) ensurePokeTraceWsBridge();

  buildInFlight = buildLiveMarketTicker()
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

  if (!refresh && cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return NextResponse.json(cache.body);
  }

  if (refresh && cache?.body.ready) {
    void ensureBuilt(true);
    return NextResponse.json(cache.body);
  }

  const body = await ensureBuilt(refresh);
  return NextResponse.json(body);
}
