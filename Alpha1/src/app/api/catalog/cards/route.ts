import { NextRequest, NextResponse } from "next/server";
import { listCatalogCards } from "@/lib/catalog/catalog-browse-service";
import { parseCatalogFranchise } from "@/lib/catalog/franchise-registry";
import { cleanId, cleanPositiveInt, cleanShortText } from "@/lib/http/params";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const franchise = parseCatalogFranchise(searchParams.get("franchise"));
  const setId = cleanId(searchParams.get("setId"));
  if (!franchise) {
    return NextResponse.json({ error: "Invalid or missing franchise" }, { status: 400 });
  }
  if (!setId) {
    return NextResponse.json({ error: "setId required" }, { status: 400 });
  }
  if (franchise === "pokemon") {
    return NextResponse.json(
      { error: "Use /api/pokedex/cards for Pokémon" },
      { status: 400 },
    );
  }

  const page = cleanPositiveInt(searchParams.get("page"), 1, 500);
  const pageSize = cleanPositiveInt(searchParams.get("pageSize"), 60, 250);
  const q = cleanShortText(searchParams.get("q"), 120);

  try {
    const data = await listCatalogCards(franchise, setId, { page, pageSize, q });
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
