import { NextRequest, NextResponse } from "next/server";
import { cleanShortText } from "@/lib/http/params";
import { matchPokemonCatalog } from "@/lib/market/pokemon-catalog";
import { resolveCatalogImageUrl } from "@/lib/scan/catalog-merge";
import { extractedCardSchema } from "@/lib/scan/schemas";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const name = cleanShortText(sp.get("name"), 160) ?? "";
  const printedName = cleanShortText(sp.get("printedName"), 160) ?? "";
  const language = cleanShortText(sp.get("language"), 64) ?? "";
  if (!name && !printedName) {
    return NextResponse.json({ error: "name or printedName is required" }, { status: 400 });
  }

  const card = extractedCardSchema.parse({
    name: name || printedName,
    printedName: printedName || undefined,
    language: language || undefined,
    set: cleanShortText(sp.get("set"), 160),
    number: cleanShortText(sp.get("number"), 64),
  });

  try {
    const hit = await matchPokemonCatalog(card);
    if (!hit) {
      return NextResponse.json({ match: null });
    }
    const imageSmallUrl = resolveCatalogImageUrl(hit, card);
    if (!imageSmallUrl) {
      return NextResponse.json({ match: null });
    }
    return NextResponse.json({
      match: {
        catalogId: hit.catalogId,
        imageSmallUrl,
        imageLargeUrl: hit.imageLargeUrl ?? imageSmallUrl,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
