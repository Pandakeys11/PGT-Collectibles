import { NextRequest, NextResponse } from "next/server";
import { cleanId } from "@/lib/http/params";
import { fetchCardsForSetPage, fetchRarityCountsForSet } from "@/lib/pokedex/tcg-api-server";
import {
  RARITY_TAB_ORDER,
  type RarityBucketId,
} from "@/lib/pokedex/rarity-buckets";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const setId = cleanId(new URL(req.url).searchParams.get("setId"));
  if (!setId) {
    return NextResponse.json(
      { error: "valid setId is required" },
      { status: 400 },
    );
  }

  try {
    const fromDb = await fetchRarityCountsForSet(setId);
    if (fromDb) {
      return NextResponse.json({ counts: fromDb, source: "db" });
    }

    const pairs = await Promise.all(
      RARITY_TAB_ORDER.map(async (bucket) => {
        const data = await fetchCardsForSetPage({
          setId,
          page: 1,
          pageSize: 1,
          rarityBucket: bucket,
        });
        return [bucket, data.totalCount] as const;
      }),
    );
    const counts = Object.fromEntries(pairs) as Record<RarityBucketId, number>;
    return NextResponse.json({ counts, source: "api" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
