import { NextRequest, NextResponse } from "next/server";
import { buildEbayEndingSoonFeed } from "@/lib/market/build-ebay-ending-soon";
import {
  DEFAULT_EBAY_ENDING_SOON_FEED_ID,
  resolveEbayEndingSoonFeed,
} from "@/lib/market/ebay-ending-soon-feeds";
import type { EbayEndingSoonPayload } from "@/lib/market/ebay-ending-soon-types";
import { registerRuntimeCacheClear } from "@/lib/server/runtime-caches";

export const dynamic = "force-dynamic";

/** Short TTL — auction end times move quickly. */
const CACHE_TTL_MS = 3 * 60 * 1000;
const cache = new Map<string, { at: number; body: EbayEndingSoonPayload }>();
const buildInFlight = new Map<string, Promise<EbayEndingSoonPayload>>();

registerRuntimeCacheClear(() => {
  cache.clear();
  buildInFlight.clear();
});

function cacheKey(feedId: string, refresh: boolean): string {
  return `${feedId}|${refresh ? "1" : "0"}`;
}

async function ensureBuilt(
  feedId: string,
  refresh: boolean,
): Promise<EbayEndingSoonPayload> {
  const key = cacheKey(feedId, false);
  if (!refresh) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.body;
  }

  const inflightKey = cacheKey(feedId, refresh);
  const existing = buildInFlight.get(inflightKey);
  if (existing) return existing;

  const promise = buildEbayEndingSoonFeed(feedId)
    .then((body) => {
      if (body.ready) {
        cache.set(cacheKey(feedId, false), { at: Date.now(), body });
      }
      return body;
    })
    .finally(() => {
      buildInFlight.delete(inflightKey);
    });

  buildInFlight.set(inflightKey, promise);
  return promise;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const refresh = url.searchParams.get("refresh") === "1";
  const feed = resolveEbayEndingSoonFeed(
    url.searchParams.get("feed") ?? DEFAULT_EBAY_ENDING_SOON_FEED_ID,
  );
  const feedId = feed.id;
  const key = cacheKey(feedId, false);

  if (!refresh) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      return NextResponse.json(hit.body);
    }
  }

  if (refresh) {
    const hit = cache.get(key);
    if (hit?.body.ready) {
      void ensureBuilt(feedId, true);
      return NextResponse.json(hit.body);
    }
  }

  const body = await ensureBuilt(feedId, refresh);
  return NextResponse.json(body);
}
