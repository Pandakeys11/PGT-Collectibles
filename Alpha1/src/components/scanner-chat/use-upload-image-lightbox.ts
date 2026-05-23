"use client";

import { useCallback, useMemo, useState } from "react";
import type { LightboxImage } from "@/components/ui/image-lightbox";

export function useUploadImageLightbox(
  images: Array<{ id: string; previewUrl: string; label?: string }>,
) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  const gallery: LightboxImage[] = useMemo(
    () =>
      images.map((img, i) => ({
        src: img.previewUrl,
        alt: img.label ?? `Upload ${i + 1}`,
        caption: img.label ?? `Image ${i + 1} of ${images.length}`,
      })),
    [images],
  );

  const openAt = useCallback((at: number) => {
    if (images.length === 0) return;
    setIndex(Math.min(Math.max(0, at), images.length - 1));
    setOpen(true);
  }, [images.length]);

  const close = useCallback(() => setOpen(false), []);

  return {
    gallery,
    open,
    index,
    setIndex,
    openAt,
    close,
  };
}
