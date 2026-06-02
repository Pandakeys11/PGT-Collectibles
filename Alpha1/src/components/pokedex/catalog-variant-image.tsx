"use client";

import { useEffect, useState } from "react";
import { catalogImageSrc } from "@/lib/ui/catalog-image-url";
import { cn } from "@/lib/cn";

type Props = {
  /** Primary artwork (usually Pokémon TCG API or TCGdex). */
  apiSrc: string | undefined;
  /** Curated / variant scan when distinct from API. */
  preferredSrc: string | undefined;
  /** When false, never show API art if preferred is missing (print-run tabs). */
  allowApiFallback?: boolean;
  /** Shown when allowApiFallback is false and no preferred image. */
  missingLabel?: string;
  alt: string;
  className?: string;
  priority?: boolean;
};

/**
 * Tries `preferredSrc` first when distinct, then falls back to `apiSrc`.
 * Routes through `/api/img` for long-lived browser cache.
 */
export function CatalogVariantImage({
  apiSrc,
  preferredSrc,
  allowApiFallback = true,
  missingLabel,
  alt,
  className,
  priority = false,
}: Props) {
  const preferred = preferredSrc?.trim();
  const api = apiSrc?.trim();
  const fallback = allowApiFallback ? api : undefined;
  const initial = catalogImageSrc(preferred || fallback);
  const [src, setSrc] = useState(initial);
  const [triedPreferred, setTriedPreferred] = useState(false);

  useEffect(() => {
    setTriedPreferred(false);
    setSrc(catalogImageSrc(preferred || fallback));
  }, [preferred, fallback]);

  if (!src) {
    return (
      <div
        className={cn(
          "flex h-full w-full flex-col items-center justify-center gap-1 px-2 text-center text-[10px] text-faint",
          className,
        )}
      >
        {missingLabel ?? "No artwork"}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={cn(className)}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      onError={() => {
        const preferredResolved = catalogImageSrc(preferred);
        const fallbackResolved = catalogImageSrc(fallback);
        if (preferred && !triedPreferred && src === preferredResolved && fallbackResolved) {
          setTriedPreferred(true);
          setSrc(fallbackResolved);
          return;
        }
        if (preferred && src === preferredResolved && !allowApiFallback) {
          setSrc("");
          return;
        }
        if (api && src === catalogImageSrc(api)) {
          setSrc("");
        }
      }}
    />
  );
}
