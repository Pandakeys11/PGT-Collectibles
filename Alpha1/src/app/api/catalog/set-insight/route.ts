import { NextRequest, NextResponse } from "next/server";
import { getSetInsightCacheTtlMs } from "@/lib/ai/research-budget";
import { buildCatalogSetInsight } from "@/lib/catalog/build-catalog-set-insight";
import type { CatalogSetInsightPayload } from "@/lib/catalog/set-insight-payload";
import {
  persistSetInsight,
  readPersistedSetInsight,
} from "@/lib/catalog/set-insight-persist";
import { cleanId } from "@/lib/http/params";
import { registerRuntimeCacheClear } from "@/lib/server/runtime-caches";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const CACHE_TTL_MS = getSetInsightCacheTtlMs();
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
    void ensureBuilt(setId, true);
    return NextResponse.json(hit.body);
  }

  const body = await ensureBuilt(setId, refresh);
  if (!body.ready) {
    return NextResponse.json({
      ...body,
      error: body.setWide.cardCount > 0 ? "insight_empty" : "set_not_found",
    });
  }
  return NextResponse.json(body);
}

async function ensureBuilt(setId: string, refreshAi = false): Promise<CatalogSetInsightPayload> {
  const cached = cache.get(setId);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS && !refreshAi) return cached.body;

  if (!refreshAi) {
    const persisted = await readPersistedSetInsight(setId);
    if (persisted) {
      cache.set(setId, { at: Date.now(), body: persisted });
      return persisted;
    }
  }

  let pending = buildInFlight.get(setId);
  if (!pending) {
    pending = buildCatalogSetInsight(setId, { refreshAi })
      .then(async (body) => {
        if (body.ready) {
          cache.set(setId, { at: Date.now(), body });
          await persistSetInsight(body);
        }
        return body;
      })
      .finally(() => {
        buildInFlight.delete(setId);
      });
    buildInFlight.set(setId, pending);
  }
  return pending;
}
