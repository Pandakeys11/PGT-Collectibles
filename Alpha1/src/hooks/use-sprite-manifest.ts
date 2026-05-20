"use client";

import { useEffect, useState } from "react";
import { fetchSpriteManifest } from "@/lib/companion/load-sprite-manifest";
import { isHostedSpritesEnabled } from "@/lib/companion/sprite-assets";

/**
 * Loads `/companion-sprite-manifest.json` when hosted sprites are enabled.
 */
export function useSpriteManifest(): { ready: boolean; enabled: boolean } {
  const enabled = isHostedSpritesEnabled();
  const [ready, setReady] = useState(!enabled);

  useEffect(() => {
    if (!enabled) {
      setReady(true);
      return;
    }
    let cancelled = false;
    void fetchSpriteManifest().finally(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { ready, enabled };
}
