import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { refreshPokemonMarketKnowledge } from "@/lib/market/refresh-pokemon-market-knowledge";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Live market refresh for a locked `catalog_id`.
 * Runs full ingest when institutional memory is thin or `force: true`.
 */
export async function POST(req: NextRequest) {
  await auth.protect();

  let catalogId = "";
  let force = false;
  try {
    const body = (await req.json()) as { catalogId?: string; force?: boolean };
    catalogId = body.catalogId?.trim() ?? "";
    force = body.force === true;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!catalogId) {
    return NextResponse.json({ error: "catalogId required" }, { status: 400 });
  }

  const result = await refreshPokemonMarketKnowledge(catalogId, { force });
  if (!result) {
    return NextResponse.json(
      { catalogId, ready: false, error: "Card not found in catalog" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ready: true,
    liveRefreshRan: result.liveRefreshRan,
    ingest: result.ingest,
    ...result.knowledge,
  });
}
