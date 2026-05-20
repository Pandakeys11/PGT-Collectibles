import { NextRequest, NextResponse } from "next/server";
import { cleanId } from "@/lib/http/params";
import { fetchPokemonCardById } from "@/lib/pokedex/tcg-api-server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const id = cleanId(new URL(req.url).searchParams.get("id"));
  if (!id) {
    return NextResponse.json(
      { error: "valid id is required" },
      { status: 400 },
    );
  }

  try {
    const card = await fetchPokemonCardById(id);
    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }
    return NextResponse.json({ card });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
