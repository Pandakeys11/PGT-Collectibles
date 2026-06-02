"use client";

import { useState } from "react";
import { catalogImageSrc } from "@/lib/ui/catalog-image-url";
import { cn } from "@/lib/cn";

type CatalogCardImageProps = {
  src: string | undefined | null;
  alt?: string;
  className?: string;
  /** First visible row — eager + high fetch priority. */
  priority?: boolean;
  onError?: () => void;
};

export function CatalogCardImage({
  src,
  alt = "",
  className,
  priority = false,
  onError,
}: CatalogCardImageProps) {
  const resolved = catalogImageSrc(src);
  const [failed, setFailed] = useState(false);

  if (!resolved || failed) {
    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-center bg-black/30 text-[9px] text-faint",
          className,
        )}
        aria-hidden
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolved}
      alt={alt}
      className={cn("h-full w-full object-contain", className)}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      onError={() => {
        setFailed(true);
        onError?.();
      }}
    />
  );
}
