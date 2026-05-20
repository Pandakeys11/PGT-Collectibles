"use client";

import { useEffect, useState } from "react";
import { cropImageWithVisionLocation } from "@/lib/scan/specimen-crop";
import { normalizeVisionGridLocation, type VisionGridLocation } from "@/lib/scan/spatial";

export function useSpecimenCropPreview(args: {
  fullSrc: string | null;
  location: unknown;
  /** When set (multi-card capture), aligns crop with extracted row order on the sheet. */
  evidenceCropLocation?: VisionGridLocation | null;
  radiusMultiplier?: number;
  gradedSlab: boolean;
  maxOutputSide: number;
  enabled?: boolean;
}): { displaySrc: string | null; cropping: boolean; hasFullSrc: boolean } {
  const { fullSrc, location, evidenceCropLocation, radiusMultiplier, gradedSlab, maxOutputSide, enabled = true } =
    args;
  const [cropped, setCropped] = useState<string | null>(null);
  const [cropping, setCropping] = useState(false);

  useEffect(() => {
    if (!enabled || !fullSrc) {
      setCropped(null);
      setCropping(false);
      return;
    }

    let cancelled = false;
    const loc = evidenceCropLocation ?? normalizeVisionGridLocation(location);

    setCropping(true);
    void cropImageWithVisionLocation(fullSrc, loc, {
      gradedSlab,
      maxOutputSide,
      radiusMultiplier,
    })
      .then((url) => {
        if (cancelled) return;
        setCropped(url);
      })
      .finally(() => {
        if (!cancelled) setCropping(false);
      });

    return () => {
      cancelled = true;
      setCropping(false);
    };
  }, [enabled, fullSrc, location, evidenceCropLocation, radiusMultiplier, gradedSlab, maxOutputSide]);

  return {
    displaySrc: cropped ?? fullSrc,
    cropping: cropping && !cropped,
    hasFullSrc: Boolean(fullSrc),
  };
}
