"use client";

import { catalogImageSrc } from "@/lib/ui/catalog-image-url";
import { cn } from "@/lib/cn";

/** Small market/catalog thumb — same `/api/img` proxy as master catalog. */
export function MarketCardThumb({
  src,
  alt = "",
  className,
  priority = false,
  onError,
}: {
  src: string | undefined | null;
  alt?: string;
  className?: string;
  priority?: boolean;
  onError?: () => void;
}) {
  const resolved = catalogImageSrc(src);
  if (!resolved) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolved}
      alt={alt}
      className={cn("h-full w-full object-contain", className)}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      onError={onError}
    />
  );
}
