/**
 * Option B — read sprite metadata from Supabase when configured (non-blocking).
 */

import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";

export type PokemonSpriteAssetRow = {
  national_id: number;
  showdown_slug: string;
  has_ani: boolean;
  has_artwork: boolean;
  ani_public_url: string | null;
  artwork_public_url: string | null;
};

let cache: Map<number, PokemonSpriteAssetRow> | null = null;
let cacheAt = 0;
const CACHE_MS = 5 * 60 * 1000;

export async function fetchSpriteAssetRow(
  nationalId: number,
): Promise<PokemonSpriteAssetRow | null> {
  if (!isSupabaseConfigured()) return null;
  const now = Date.now();
  if (!cache || now - cacheAt > CACHE_MS) {
    try {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from("pokemon_sprite_assets")
        .select(
          "national_id,showdown_slug,has_ani,has_artwork,ani_public_url,artwork_public_url",
        );
      if (error || !data) {
        cache = new Map();
      } else {
        cache = new Map(
          (data as PokemonSpriteAssetRow[]).map((row) => [row.national_id, row]),
        );
      }
      cacheAt = now;
    } catch {
      return null;
    }
  }
  return cache?.get(nationalId) ?? null;
}

export function clearSpriteAssetCache(): void {
  cache = null;
  cacheAt = 0;
}
