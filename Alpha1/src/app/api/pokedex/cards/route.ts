import { NextRequest, NextResponse } from "next/server";
import { cleanId, cleanPositiveInt } from "@/lib/http/params";
import { fetchCardsForSetPage } from "@/lib/pokedex/tcg-api-server";
import {
  RARITY_TAB_ORDER,
  type RarityBucketId,
} from "@/lib/pokedex/rarity-buckets";
import type { CatalogFinishBucketId } from "@/lib/pokedex/set-catalog-config";
import type { PrintingPresetId } from "@/lib/pokedex/printing-presets";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function parseRarityBucket(raw: string | null): RarityBucketId | undefined {
  if (!raw?.trim()) return undefined;
  const v = raw.trim() as RarityBucketId;
  return RARITY_TAB_ORDER.includes(v) ? v : undefined;
}

function parseFinishBucket(
  raw: string | null,
): CatalogFinishBucketId | undefined {
  if (!raw?.trim()) return undefined;
  const v = raw.trim() as CatalogFinishBucketId;
  return v === "all" || v === "rare_holo" || v === "rare_non_holo" || v === "reverse_holo"
    ? v
    : undefined;
}

function parsePrintingPreset(raw: string | null): PrintingPresetId | undefined {
  if (!raw?.trim()) return undefined;
  const v = raw.trim() as PrintingPresetId;
  return v === "catalog" || v === "unlimited" || v === "first_edition" || v === "shadowless"
    ? v
    : undefined;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const setId = cleanId(searchParams.get("setId"));
  const page = cleanPositiveInt(searchParams.get("page"), 1, 500);
  const pageSize = cleanPositiveInt(searchParams.get("pageSize"), 50, 100);
  const rarityBucket = parseRarityBucket(searchParams.get("rarityBucket"));
  const finishBucket = parseFinishBucket(searchParams.get("finishBucket"));
  const printingPreset = parsePrintingPreset(searchParams.get("printingPreset"));

  if (!setId) {
    return NextResponse.json(
      { error: "valid setId is required" },
      { status: 400 },
    );
  }

  try {
    const data = await fetchCardsForSetPage({
      setId,
      page,
      pageSize,
      rarityBucket,
      finishBucket,
      printingPreset,
    });
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
