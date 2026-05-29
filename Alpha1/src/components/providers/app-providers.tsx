"use client";

import type { ReactNode } from "react";
import { PgtMusicWidget } from "@/components/music/pgt-music-widget";
import { CatalogAmbientProvider } from "@/components/effects/catalog-ambient-provider";
import { MotionProvider } from "@/components/motion/motion-provider";
import { PgtMusicProvider } from "@/providers/pgt-music-provider";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <MotionProvider>
      <CatalogAmbientProvider>
        <PgtMusicProvider>
          {children}
          <PgtMusicWidget />
        </PgtMusicProvider>
      </CatalogAmbientProvider>
    </MotionProvider>
  );
}
