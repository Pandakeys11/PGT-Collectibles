import { NextRequest, NextResponse } from "next/server";
import { cleanId, cleanShortText } from "@/lib/http/params";
import {
  buildEbayGradeHubs,
  buildMarketSourceLinks,
} from "@/lib/market/sources";
import { buildCatalogMarketSnapshot } from "@/lib/pokedex/catalog-market-snapshot";
import { collectCatalogMarketEvidence } from "@/lib/pokedex/collect-catalog-market";
import { fetchPokemonCardById } from "@/lib/pokedex/tcg-api-server";
import { registerRuntimeCacheClear } from "@/lib/server/runtime-caches";
import { extractedCardSchema } from "@/lib/scan/schemas";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

const CACHE_TTL_MS = 12 * 60 * 1000;
const cache = new Map<string, { at: number; body: unknown }>();

registerRuntimeCacheClear(() => cache.clear());

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const id = cleanId(url.searchParams.get("id"));
  if (!id) {
    return NextResponse.json(
      { error: "valid id is required" },
      { status: 400 },
    );
  }

  const printingHint =
    cleanShortText(url.searchParams.get("printing"), 120) ?? "";
  const refresh = url.searchParams.get("refresh") === "1";
  const cacheKey = `${id}|${printingHint}`;
  const cached = !refresh ? cache.get(cacheKey) : undefined;
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return NextResponse.json(cached.body);
  }

  try {
    const card = await fetchPokemonCardById(id, { cache: "no-store" });
    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    const marketEvidence = await collectCatalogMarketEvidence(card);
    const snapshot = buildCatalogMarketSnapshot(card, marketEvidence);
    const extracted = extractedCardSchema.parse({
      name: card.name,
      set: card.set?.name,
      number: card.number,
      rarity: card.rarity,
      year: card.set?.releaseDate?.slice(0, 4),
      printStamps: printingHint || undefined,
    });
    const marketSourceLinks = buildMarketSourceLinks(extracted);
    const ebayGradeHubs = buildEbayGradeHubs(extracted);

    const body = {
      cardId: id,
      snapshot,
      marketSourceLinks,
      ebayGradeHubs,
    };
    cache.set(cacheKey, { at: Date.now(), body });
    return NextResponse.json(body);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
