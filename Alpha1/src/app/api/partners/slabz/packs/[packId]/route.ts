import { NextRequest, NextResponse } from "next/server";
import { fetchSlabzPack } from "@/lib/slabz/service";
import { isSlabzPartnerConfigured } from "@/lib/slabz/config";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ packId: string }> },
) {
  const { packId } = await ctx.params;
  if (!isSlabzPartnerConfigured()) {
    return NextResponse.json({ error: "Slabz not configured" }, { status: 503 });
  }
  try {
    const pack = await fetchSlabzPack(packId);
    if (!pack) return NextResponse.json({ error: "Pack not found" }, { status: 404 });
    return NextResponse.json({ pack });
  } catch (err) {
    console.error("[partners/slabz/packs/[packId]]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load pack" },
      { status: 502 },
    );
  }
}
