import { NextRequest, NextResponse } from "next/server";
import { batchHydrateTcgCardFmv } from "@/lib/pokedex/batch-tcg-fmv";
import { cleanId } from "@/lib/http/params";
import type { TcgCardSummary } from "@/lib/pokedex/tcg-api-types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: { setId?: string; cards?: TcgCardSummary[] };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const setId = cleanId(body.setId);
  const cards = Array.isArray(body.cards) ? body.cards.slice(0, 120) : [];

  if (!setId) {
    return NextResponse.json({ error: "setId required" }, { status: 400 });
  }
  if (!cards.length) {
    return NextResponse.json({ cards: [] });
  }

  try {
    const hydrated = await batchHydrateTcgCardFmv(setId, cards);
    return NextResponse.json({ cards: hydrated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "FMV hydrate failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
