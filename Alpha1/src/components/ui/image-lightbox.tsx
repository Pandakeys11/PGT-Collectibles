"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export function ImageLightbox({
  src,
  alt,
  open,
  onClose,
  caption,
}: {
  src: string | null;
  alt: string;
  open: boolean;
  onClose: () => void;
  caption?: string | null;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (typeof document === "undefined" || !open || !src) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/90 p-3 sm:p-6"
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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="max-h-[min(88dvh,1400px)] max-w-full object-contain shadow-2xl"
        style={{ imageRendering: "auto" }}
        onClick={(e) => e.stopPropagation()}
      />
      {caption ? (
        <p className="mt-3 max-w-lg text-center text-sm text-white/80" onClick={(e) => e.stopPropagation()}>
          {caption}
        </p>
      ) : null}
    </div>,
    document.body,
  );
}
