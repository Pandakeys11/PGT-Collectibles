import { NextRequest, NextResponse } from "next/server";
import { cleanId } from "@/lib/http/params";
import { buildMarketSourceLinks } from "@/lib/market/sources";
import {
  CATALOG_OVERLAY_METHODOLOGY,
  getCatalogSetOverlay,
  hasCatalogSetOverlay,
  type SealedProductSpec,
} from "@/lib/pokedex/catalog-set-overlay";
import type {
  SetOverviewPayload,
  SetOverviewSealedRow,
} from "@/lib/pokedex/set-overview-payload";
import { rollupCatalogSetPricing } from "@/lib/pokedex/set-pricing-aggregate";
import {
  CATALOG_SET_PRICING_SELECT,
  fetchAllCardsForSet,
  fetchSetById,
} from "@/lib/pokedex/tcg-api-server";
import { registerRuntimeCacheClear } from "@/lib/server/runtime-caches";
import { extractedCardSchema } from "@/lib/scan/schemas";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const CACHE_TTL_MS = 15 * 60 * 1000;
const cache = new Map<string, { at: number; body: SetOverviewPayload }>();

registerRuntimeCacheClear(() => cache.clear());

function sealedRowLinks(
  setDisplayName: string,
  product: SealedProductSpec,
): SetOverviewSealedRow["links"] {
  const extracted = extractedCardSchema.parse({
    name: product.searchQuery,
    set: setDisplayName,
    printStamps: "sealed pokemon tcg",
  });
  return buildMarketSourceLinks(extracted);
}

export async function GET(req: NextRequest) {
  const setId = cleanId(new URL(req.url).searchParams.get("setId"));
  if (!setId) {
    return NextResponse.json(
      { error: "valid setId is required" },
      { status: 400 },
    );
  }

  const refresh = new URL(req.url).searchParams.get("refresh") === "1";
  const cached = !refresh ? cache.get(setId) : undefined;
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return NextResponse.json(cached.body);
  }

  const set = await fetchSetById(setId);
  const setName = set?.name ?? null;

  if (!hasCatalogSetOverlay(setId)) {
    const body: SetOverviewPayload = { supported: false, setId, setName };
    cache.set(setId, { at: Date.now(), body });
    return NextResponse.json(body);
  }

  const overlay = getCatalogSetOverlay(setId)!;
  const displayName = setName ?? setId;

  const cards = await fetchAllCardsForSet({
    setId,
    select: CATALOG_SET_PRICING_SELECT,
  });
  const rollup = rollupCatalogSetPricing(cards);

  const sealedProducts: SetOverviewSealedRow[] = overlay.sealedProducts.map(
    (p) => ({
      id: p.id,
      label: p.label,
      category: p.category,
      searchQuery: p.searchQuery,
      links: sealedRowLinks(displayName, p),
    }),
  );

  const references: { label: string; url: string; note?: string }[] = [
    {
      label: "Pokémon TCG API",
      url: "https://pokemontcg.io/",
      note: "Catalog spine & embedded TCGPlayer/Cardmarket snapshots on each card.",
    },
  ];
  if (overlay.bulbapediaUrl) {
    references.push({
      label: "Bulbapedia (set article)",
      url: overlay.bulbapediaUrl,
      note: "Print-run context and set composition (editorial wiki).",
    });
  }

  const body: SetOverviewPayload = {
    supported: true,
    setId,
    setName: displayName,
    methodology: CATALOG_OVERLAY_METHODOLOGY,
    setValueNotes: overlay.setValueNotes,
    bulbapediaUrl: overlay.bulbapediaUrl,
    pricing: {
      cardCount: rollup.cardCount,
      tcgPlayerSumUsd: Math.round(rollup.tcgPlayerSumUsd * 100) / 100,
      tcgPlayerPricedSlots: rollup.tcgPlayerPricedSlots,
      cardmarketSumEur: Math.round(rollup.cardmarketSumEur * 100) / 100,
      cardmarketPricedSlots: rollup.cardmarketPricedSlots,
    },
    sealedProducts,
    references,
  };

  cache.set(setId, { at: Date.now(), body });
  return NextResponse.json(body);
}
