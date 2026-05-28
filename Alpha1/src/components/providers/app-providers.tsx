"use client";

import type { ReactNode } from "react";
import { CatalogAmbientProvider } from "@/components/effects/catalog-ambient-provider";
import { MotionProvider } from "@/components/motion/motion-provider";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <MotionProvider>
      <CatalogAmbientProvider>{children}</CatalogAmbientProvider>
    </MotionProvider>
  );
}
