import { NextRequest, NextResponse } from "next/server";
import { cleanPositiveInt, cleanShortText } from "@/lib/http/params";
import { fetchSetsPage } from "@/lib/pokedex/tcg-api-server";
import { SET_ERA_ORDER, type SetEraId } from "@/lib/pokedex/set-era";

export const dynamic = "force-dynamic";

function parseEra(raw: string | null): SetEraId | null {
  if (!raw) return null;
  return SET_ERA_ORDER.includes(raw as SetEraId) ? (raw as SetEraId) : null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = cleanPositiveInt(searchParams.get("page"), 1, 500);
  const pageSize = cleanPositiveInt(searchParams.get("pageSize"), 40, 100);
  const q = cleanShortText(searchParams.get("q"), 120);
  const orderBy = cleanShortText(searchParams.get("orderBy"), 32);
  const era = parseEra(searchParams.get("era"));

  if (!era) {
    return NextResponse.json(
      { error: "Invalid or missing era" },
      { status: 400 },
    );
  }

  try {
    const data = await fetchSetsPage({
      page,
      pageSize,
      q: q || undefined,
      orderBy,
      era,
    });
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
