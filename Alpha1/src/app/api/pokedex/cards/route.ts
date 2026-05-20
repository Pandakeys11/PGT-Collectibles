import { NextRequest, NextResponse } from "next/server";
import { cleanId, cleanPositiveInt } from "@/lib/http/params";
import { fetchCardsForSetPage } from "@/lib/pokedex/tcg-api-server";
import {
  RARITY_TAB_ORDER,
  type RarityBucketId,
} from "@/lib/pokedex/rarity-buckets";
import type { CatalogFinishBucketId } from "@/lib/pokedex/set-catalog-config";

export const dynamic = "force-dynamic";

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
  return v === "all" || v === "rare_holo" || v === "rare_non_holo"
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
    });
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
