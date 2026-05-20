"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

type Props = {
  /** Pokémon TCG API image (fallback when curated asset missing or fails to load). */
  apiSrc: string | undefined;
  /** Curated scan URL (manifest or conventional path under `/catalog-variant-artwork/`). */
  preferredSrc: string | undefined;
  alt: string;
  className?: string;
};

/**
 * Tries `preferredSrc` first (true variant scan), then falls back to `apiSrc` on error
 * so the grid stays usable until every asset exists.
 */
export function CatalogVariantImage({ apiSrc, preferredSrc, alt, className }: Props) {
  const [src, setSrc] = useState(() => preferredSrc?.trim() || apiSrc);

  useEffect(() => {
    setSrc(preferredSrc?.trim() || apiSrc);
  }, [preferredSrc, apiSrc]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src || ""}
      alt={alt}
      className={cn(className)}
      loading="lazy"
      onError={() => {
        if (apiSrc && src !== apiSrc) setSrc(apiSrc);
        else if (!apiSrc) setSrc("");
      }}
    />
  );
}
