"use client";

import { useCallback, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/cn";

export type LightboxImage = {
  src: string;
  alt: string;
  caption?: string | null;
};

export function ImageLightbox({
  src,
  alt,
  open,
  onClose,
  caption,
  gallery,
  galleryIndex = 0,
  onGalleryIndexChange,
}: {
  src: string | null;
  alt: string;
  open: boolean;
  onClose: () => void;
  caption?: string | null;
  /** Multi-image gallery; when set, `src`/`alt`/`caption` are ignored in favor of `gallery[galleryIndex]`. */
  gallery?: LightboxImage[];
  galleryIndex?: number;
  onGalleryIndexChange?: (index: number) => void;
}) {
  const items: LightboxImage[] =
    gallery && gallery.length > 0
      ? gallery
      : src
        ? [{ src, alt, caption }]
        : [];

  const safeIndex =
    items.length > 0 ? Math.min(Math.max(0, galleryIndex), items.length - 1) : 0;
  const current = items[safeIndex];
  const hasNav = items.length > 1 && Boolean(onGalleryIndexChange);

  const goPrev = useCallback(() => {
    if (!onGalleryIndexChange || items.length < 2) return;
    onGalleryIndexChange((safeIndex - 1 + items.length) % items.length);
  }, [items.length, onGalleryIndexChange, safeIndex]);

  const goNext = useCallback(() => {
    if (!onGalleryIndexChange || items.length < 2) return;
    onGalleryIndexChange((safeIndex + 1) % items.length);
  }, [items.length, onGalleryIndexChange, safeIndex]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, goPrev, goNext]);

  if (typeof document === "undefined" || !open || !current?.src) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={current.alt}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/92 p-3 sm:p-6"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white transition hover:bg-white/10 touch-manipulation sm:right-4 sm:top-4"
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>

      {hasNav ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          className="absolute left-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white transition hover:bg-white/10 touch-manipulation sm:left-4"
          aria-label="Previous image"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      ) : null}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={current.src}
        src={current.src}
        alt={current.alt}
        className="max-h-[min(82dvh,1400px)] max-w-full select-none object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />

      {hasNav ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          className="absolute right-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white transition hover:bg-white/10 touch-manipulation sm:right-4"
          aria-label="Next image"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      ) : null}

      <div
        className="mt-3 flex max-w-lg flex-col items-center gap-1 px-4"
        onClick={(e) => e.stopPropagation()}
      >
        {items.length > 1 ? (
          <p className="text-[11px] font-medium tabular-nums text-white/50">
            {safeIndex + 1} / {items.length}
          </p>
        ) : null}
        {current.caption ? (
          <p className="text-center text-sm text-white/80">{current.caption}</p>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

/** Clickable thumbnail that opens a lightbox gallery at this index. */
export function ExpandableImageThumb({
  src,
  alt,
  galleryIndex,
  onOpenGallery,
  className,
  imageClassName,
  children,
}: {
  src: string;
  alt: string;
  /** Reserved for future caption overlay in lightbox parent. */
  caption?: string;
  /** Reserved — parent owns gallery state via onOpenGallery. */
  gallery: LightboxImage[];
  galleryIndex: number;
  onOpenGallery: (index: number) => void;
  className?: string;
  imageClassName?: string;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpenGallery(galleryIndex)}
      className={cn(
        "group relative overflow-hidden rounded-xl ring-1 ring-white/10 transition hover:ring-emerald-500/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 touch-manipulation",
        className,
      )}
      aria-label={`View full size: ${alt}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className={cn("h-full w-full object-cover", imageClassName)} />
      <span className="pointer-events-none absolute inset-0 bg-black/0 transition group-hover:bg-black/15 group-active:bg-black/25" />
      {children}
    </button>
  );
}
