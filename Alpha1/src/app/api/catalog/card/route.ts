import { NextRequest, NextResponse } from "next/server";
import { getCatalogCard } from "@/lib/catalog/catalog-browse-service";
import { parseCatalogFranchise } from "@/lib/catalog/franchise-registry";
import { cleanShortText } from "@/lib/http/params";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const franchise = parseCatalogFranchise(searchParams.get("franchise"));
  const id = cleanShortText(searchParams.get("id"), 200);
  if (!franchise || !id) {
    return NextResponse.json({ error: "franchise and id required" }, { status: 400 });
  }

  try {
    const card = await getCatalogCard(franchise, id);
    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }
    return NextResponse.json({ card });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
