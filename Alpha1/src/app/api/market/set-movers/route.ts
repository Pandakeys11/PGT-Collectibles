import { NextRequest, NextResponse } from "next/server";
import { buildSetMovers } from "@/lib/market/build-weekly-movers";
import { registerRuntimeCacheClear } from "@/lib/server/runtime-caches";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

const CACHE_TTL_MS = 12 * 60 * 1000;
const cache = new Map<string, { at: number; body: Awaited<ReturnType<typeof buildSetMovers>> }>();
const inFlight = new Map<string, Promise<Awaited<ReturnType<typeof buildSetMovers>>>>();

registerRuntimeCacheClear(() => {
  cache.clear();
  inFlight.clear();
});

async function ensureBuilt(setId: string, setName: string | null, refresh: boolean) {
  const key = setId.trim();
  if (!key) {
    return buildSetMovers("", setName);
  }

  if (!refresh) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.body;
  }

  const pending = inFlight.get(key);
  if (pending) return pending;

  const promise = buildSetMovers(key, setName)
    .then((body) => {
      if (body.ready) cache.set(key, { at: Date.now(), body });
      return body;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, promise);
  return promise;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const setId = searchParams.get("setId")?.trim() ?? "";
  const setName = searchParams.get("setName")?.trim() || null;
  const refresh = searchParams.get("refresh") === "1";

  if (!setId) {
    return NextResponse.json({ error: "setId required" }, { status: 400 });
  }

  const body = await ensureBuilt(setId, setName, refresh);
  const res = NextResponse.json(body);
  res.headers.set("Cache-Control", refresh ? "no-store" : "private, max-age=300");
  return res;
}
