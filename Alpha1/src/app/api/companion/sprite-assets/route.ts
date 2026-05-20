import { NextResponse } from "next/server";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import { resolveHostedCdnBase } from "@/lib/companion/sprite-assets";
import type { SpriteAssetManifest } from "@/lib/companion/sprite-manifest-types";

export const revalidate = 300;

export async function GET() {
  const cdnBase = resolveHostedCdnBase() ?? "";

  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      version: 1,
      updatedAt: new Date().toISOString(),
      cdnBase,
      entries: [],
      source: "none",
    } satisfies SpriteAssetManifest & { source: string });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("pokemon_sprite_assets")
      .select(
        "national_id,showdown_slug,has_ani,has_artwork,ani_public_url,artwork_public_url,updated_at",
      )
      .order("national_id", { ascending: true });

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("does not exist") || msg.includes("schema cache")) {
        return NextResponse.json({
          version: 1,
          updatedAt: new Date().toISOString(),
          cdnBase,
          entries: [],
          source: "table_missing",
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const entries = (data ?? []).map((row) => ({
      nationalId: row.national_id as number,
      slug: row.showdown_slug as string,
      name: "",
      hasAni: Boolean(row.has_ani),
      hasArtwork: Boolean(row.has_artwork),
      aniUrl: (row.ani_public_url as string | null) ?? null,
      artworkUrl: (row.artwork_public_url as string | null) ?? null,
    }));

    const manifest: SpriteAssetManifest & { source: string } = {
      version: 1,
      updatedAt: new Date().toISOString(),
      cdnBase,
      entries,
      source: "database",
    };

    return NextResponse.json(manifest);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unable to load sprite assets" },
      { status: 500 },
    );
  }
}
