import { NextRequest, NextResponse } from "next/server";
import { buildEbayEndingSoonFeed } from "@/lib/market/build-ebay-ending-soon";
import type { EbayEndingSoonPayload } from "@/lib/market/ebay-ending-soon-types";
import { registerRuntimeCacheClear } from "@/lib/server/runtime-caches";

export const dynamic = "force-dynamic";

/** Short TTL — auction end times move quickly. */
const CACHE_TTL_MS = 3 * 60 * 1000;
let cache: { at: number; body: EbayEndingSoonPayload } | null = null;
let buildInFlight: Promise<EbayEndingSoonPayload> | null = null;

registerRuntimeCacheClear(() => {
  cache = null;
  buildInFlight = null;
});

async function ensureBuilt(refresh: boolean): Promise<EbayEndingSoonPayload> {
  if (!refresh && cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.body;
  }

  if (buildInFlight) return buildInFlight;

  buildInFlight = buildEbayEndingSoonFeed()
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
