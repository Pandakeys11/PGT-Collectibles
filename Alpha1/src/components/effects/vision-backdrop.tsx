"use client";

import { BrandTexture } from "@/components/branding/brand-texture";
import { VisionFieldClient } from "@/components/effects/vision-field-client";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

/**
 * Full-viewport ambient layer: CSS aurora + optional WebGL sparkles.
 */
export function VisionBackdrop() {
  const reducedMotion = useReducedMotion();

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <div className="vision-aurora absolute inset-0" />
      <BrandTexture />
      <div className="vision-vignette absolute inset-0" />
      {!reducedMotion ? (
        <div className="vision-webgl absolute inset-0 min-h-[100dvh] opacity-[0.55] mix-blend-screen">
          <VisionFieldClient />
        </div>
      ) : null}
      <div className="vision-noise absolute inset-0 opacity-[0.22]" />
    </div>
  );
}
