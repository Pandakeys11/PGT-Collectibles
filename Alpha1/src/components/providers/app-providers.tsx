"use client";

import type { ReactNode } from "react";
import { OmegaMusicWidget } from "@/components/music/omega-music-widget";
import { CatalogAmbientProvider } from "@/components/effects/catalog-ambient-provider";
import { MotionProvider } from "@/components/motion/motion-provider";
import { OmegaMusicProvider } from "@/providers/omega-music-provider";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <MotionProvider>
      <CatalogAmbientProvider>
        <OmegaMusicProvider>
          {children}
          <OmegaMusicWidget />
        </OmegaMusicProvider>
      </CatalogAmbientProvider>
    </MotionProvider>
  );
}
