import { NextRequest, NextResponse } from "next/server";
import { readCatalogMarketIntel } from "@/lib/pgt-registry/pgt-market-intel-persist";

export const dynamic = "force-dynamic";

/** Phase B read API — historical comps + population + cert rows by catalog_id. */
export async function GET(req: NextRequest) {
  const catalogId = req.nextUrl.searchParams.get("catalogId")?.trim() ?? "";
  if (!catalogId) {
    return NextResponse.json({ error: "catalogId required" }, { status: 400 });
  }

  const limitRaw = req.nextUrl.searchParams.get("limit");
  const compLimit = limitRaw ? Number(limitRaw) : 40;

  const intel = await readCatalogMarketIntel(catalogId, {
    compLimit: Number.isFinite(compLimit) ? compLimit : 40,
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
