import { NextRequest, NextResponse } from "next/server";
import { buildPokemonMarketKnowledge } from "@/lib/market/pokemon-market-knowledge";
import { readCatalogMarketIntel } from "@/lib/pgt-registry/pgt-market-intel-persist";

export const dynamic = "force-dynamic";

/**
 * Pokémon market knowledge by `catalog_id`.
 *
 * `?view=knowledge` (default) — full FMV intelligence + catalog + institutional memory.
 * `?view=raw` — legacy rows-only payload (comps / population / certifications).
 */
export async function GET(req: NextRequest) {
  const catalogId = req.nextUrl.searchParams.get("catalogId")?.trim() ?? "";
  if (!catalogId) {
    return NextResponse.json({ error: "catalogId required" }, { status: 400 });
  }

  const view = req.nextUrl.searchParams.get("view")?.trim() || "knowledge";
  const limitRaw = req.nextUrl.searchParams.get("limit");
  const compLimit = limitRaw ? Number(limitRaw) : 48;

  if (view === "raw") {
    const intel = await readCatalogMarketIntel(catalogId, {
      compLimit: Number.isFinite(compLimit) ? compLimit : 48,
    });
    if (!intel) {
      return NextResponse.json({
        catalogId,
        comps: [],
        population: [],
        certifications: [],
        ready: false,
      });
    }
    return NextResponse.json({ ...intel, ready: true });
  }

  const knowledge = await buildPokemonMarketKnowledge(catalogId, {
    compLimit: Number.isFinite(compLimit) ? compLimit : 48,
  });

  if (!knowledge) {
    return NextResponse.json({
      catalogId,
      ready: false,
      error: "Unable to build market knowledge",
    });
  }

  return NextResponse.json({
    ready: true,
    ...knowledge,
  });
}
