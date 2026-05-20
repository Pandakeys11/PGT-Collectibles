import {
  markSpriteManifestLoadAttempted,
  setSpriteManifestCache,
} from "@/lib/companion/sprite-manifest";
import type { SpriteAssetManifest } from "@/lib/companion/sprite-manifest-types";

/** Client: load manifest from API (DB) with static JSON fallback. */
export async function fetchSpriteManifest(): Promise<SpriteAssetManifest | null> {
  if (typeof window === "undefined") return null;

  let manifest: SpriteAssetManifest | null = null;

  try {
    const res = await fetch("/api/companion/sprite-assets", { cache: "no-store" });
    if (res.ok) {
      const body = (await res.json()) as SpriteAssetManifest;
      if (body.entries?.length) {
        setSpriteManifestCache(body);
        manifest = body;
      }
    }
  } catch {
    /* fall through */
  }

  if (!manifest) {
    try {
      const res = await fetch("/companion-sprite-manifest.json", { cache: "no-store" });
      if (res.ok) {
        const body = (await res.json()) as SpriteAssetManifest;
        if (body.entries?.length) {
          setSpriteManifestCache(body);
          manifest = body;
        }
      }
    } catch {
      /* optional */
    }
  }

  markSpriteManifestLoadAttempted();
  return manifest;
}
