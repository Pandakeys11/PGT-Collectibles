/**
 * Option B — hosted sprites (Supabase Storage + manifest).
 */

import {
  getSpriteManifestEntry,
  isSpriteManifestLoadAttempted,
} from "@/lib/companion/sprite-manifest";

const BUCKET_NAME = "pokemon-sprites";

function hostedEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_COMPANION_SPRITES_HOSTED === "1") return true;
  if (process.env.NEXT_PUBLIC_COMPANION_SPRITES_HOSTED === "0") return false;
  // Default on when CDN base is configured
  return Boolean(resolveHostedCdnBase());
}

/** Public bucket base URL (explicit CDN or derived from Supabase project URL). */
export function resolveHostedCdnBase(): string | null {
  const explicit = process.env.NEXT_PUBLIC_PGT_SPRITE_CDN?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!supabaseUrl) return null;
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${BUCKET_NAME}`;
}

function hostedBase(): string | null {
  if (!hostedEnabled()) return null;
  return resolveHostedCdnBase();
}

export function getHostedAnimatedUrl(nationalId: number): string | null {
  const row = getSpriteManifestEntry(nationalId);
  if (row) {
    if (row.hasAni && row.aniUrl) return row.aniUrl;
    if (!row.hasAni) return null;
  }

  const base = hostedBase();
  if (!base) return null;
  // Avoid guessing CDN paths before manifest load (prevents 404 flash, e.g. Miraidon).
  if (typeof window !== "undefined" && !isSpriteManifestLoadAttempted()) return null;
  return `${base}/ani/${nationalId}.gif`;
}

export function getHostedArtworkUrl(nationalId: number): string | null {
  const row = getSpriteManifestEntry(nationalId);
  if (row?.artworkUrl) return row.artworkUrl;

  const base = hostedBase();
  if (!base) return null;
  return `${base}/artwork/${nationalId}.png`;
}

export function isHostedSpritesEnabled(): boolean {
  return hostedBase() != null;
}

export function getStorageBucketName(): string {
  return BUCKET_NAME;
}
