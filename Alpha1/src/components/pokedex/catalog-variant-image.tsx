"use client";

import { useEffect, useState } from "react";
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
};

/**
 * Tries `preferredSrc` first when distinct, then falls back to `apiSrc`.
 */
export function CatalogVariantImage({
  apiSrc,
  preferredSrc,
  allowApiFallback = true,
  missingLabel,
  alt,
  className,
}: Props) {
  const preferred = preferredSrc?.trim();
  const api = apiSrc?.trim();
  const fallback = allowApiFallback ? api : undefined;
  const initial = preferred || fallback;
  const [src, setSrc] = useState(initial);
  const [triedPreferred, setTriedPreferred] = useState(false);

  useEffect(() => {
    setTriedPreferred(false);
    setSrc(preferred || fallback);
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
      loading="lazy"
      decoding="async"
      onError={() => {
        if (preferred && !triedPreferred && src === preferred && fallback) {
          setTriedPreferred(true);
          setSrc(fallback);
          return;
        }
        if (preferred && src === preferred && !allowApiFallback) {
          setSrc("");
          return;
        }
        if (api && src === api) {
          setSrc("");
        }
      }}
    />
  );
}
