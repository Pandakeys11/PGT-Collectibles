"use client";

import type { ReactNode } from "react";
import { useSpriteManifest } from "@/hooks/use-sprite-manifest";

/** Preloads hosted sprite manifest when Option B CDN is enabled (non-blocking). */
export function SpriteManifestProvider({ children }: { children: ReactNode }) {
  useSpriteManifest();
  return children;
}
