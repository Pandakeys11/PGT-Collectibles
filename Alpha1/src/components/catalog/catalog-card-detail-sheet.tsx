"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, X } from "lucide-react";
import { cn } from "@/lib/cn";

export function CatalogCardDetailSheet({
  open,
  onClose,
  title,
  subtitle,
  backLabel = "Back to cards",
  onBack,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string | null;
  backLabel?: string;
  /** When set, shows a back affordance (e.g. return to grid without closing catalog). */
  onBack?: () => void;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
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

  if (typeof document === "undefined" || !open) return null;

  return createPortal(
    <>
      <button
        type="button"
        className="sc-catalog-detail-backdrop fixed inset-0 z-[108] bg-black/65 backdrop-blur-[3px]"
        aria-label="Close card detail"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="catalog-card-detail-title"
        className={cn(
          "sc-catalog-card-sheet desk-surface-raised fixed inset-x-0 bottom-0 z-[109] flex max-h-[min(96dvh,940px)] flex-col overflow-hidden rounded-t-[1.35rem] border border-border-subtle/80 shadow-[0_-28px_64px_rgb(0_0_0/0.55)] sm:inset-y-3 sm:left-auto sm:right-3 sm:max-h-[calc(100dvh-1.5rem)] sm:w-[min(22.5rem,calc(100vw-1.5rem))] sm:rounded-2xl lg:right-4 lg:w-[min(23.5rem,calc(100vw-2rem))]",
          className,
        )}
      >
        <div className="mx-auto mt-2 h-1 w-11 shrink-0 rounded-full bg-border-subtle/80 sm:hidden" aria-hidden />

        <header className="flex shrink-0 items-center gap-2 border-b border-border-subtle/70 px-3 py-2.5 sm:px-4 sm:py-3">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1 rounded-xl px-2 text-sm font-medium text-muted transition hover:bg-panel-raised/80 hover:text-primary touch-manipulation"
              aria-label={backLabel}
            >
              <ArrowLeft className="h-5 w-5 shrink-0" aria-hidden />
              <span className="hidden min-[380px]:inline">{backLabel}</span>
            </button>
          ) : (
            <span className="w-11 shrink-0 sm:hidden" aria-hidden />
          )}
          <div className="min-w-0 flex-1 px-1 text-center sm:text-left">
            <h2
              id="catalog-card-detail-title"
              className="truncate text-sm font-semibold leading-snug text-primary sm:text-base"
            >
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-0.5 truncate text-xs text-muted">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted transition hover:bg-panel-raised/80 hover:text-primary touch-manipulation"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="sc-catalog-card-detail-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-2 pt-2 scanner-chat-scrollbar sm:px-4">
          {children}
        </div>

        {footer ? (
          <footer className="sc-catalog-card-detail-footer shrink-0 border-t border-border-subtle/70 bg-panel/80 px-3 py-2.5 backdrop-blur-sm sm:px-4">
            {footer}
          </footer>
        ) : null}
      </div>
    </>,
    document.body,
  );
}
