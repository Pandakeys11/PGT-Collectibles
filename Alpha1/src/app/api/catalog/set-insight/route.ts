import { NextRequest, NextResponse } from "next/server";
import { buildCatalogSetInsight } from "@/lib/catalog/build-catalog-set-insight";
import type { CatalogSetInsightPayload } from "@/lib/catalog/set-insight-payload";
import { cleanId } from "@/lib/http/params";
import { registerRuntimeCacheClear } from "@/lib/server/runtime-caches";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; body: CatalogSetInsightPayload }>();
let buildInFlight: Map<string, Promise<CatalogSetInsightPayload>> = new Map();

registerRuntimeCacheClear(() => {
  cache.clear();
  buildInFlight = new Map();
});

export async function GET(req: NextRequest) {
  const setId = cleanId(new URL(req.url).searchParams.get("setId"));
  if (!setId) {
    return NextResponse.json({ error: "valid setId is required" }, { status: 400 });
  }

  const refresh = new URL(req.url).searchParams.get("refresh") === "1";
  const hit = !refresh ? cache.get(setId) : undefined;
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json(hit.body);
  }

  if (refresh && hit?.body.ready) {
    void ensureBuilt(setId);
    return NextResponse.json(hit.body);
  }

  const body = await ensureBuilt(setId);
  if (!body.ready) {
    return NextResponse.json({
      ...body,
      error: body.error ?? "insight_empty",
    });
  }
  return NextResponse.json(body);
}

async function ensureBuilt(setId: string): Promise<CatalogSetInsightPayload> {
  const cached = cache.get(setId);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.body;

  let pending = buildInFlight.get(setId);
  if (!pending) {
    pending = buildCatalogSetInsight(setId)
      .then((body) => {
        if (body.ready) cache.set(setId, { at: Date.now(), body });
        return body;
      })
      .finally(() => {
        buildInFlight.delete(setId);
      });
    buildInFlight.set(setId, pending);
  }
  return pending;
}
