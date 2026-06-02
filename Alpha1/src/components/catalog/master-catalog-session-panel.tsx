"use client";

import { BookOpen, X } from "lucide-react";
import { MasterCatalogBrowser } from "@/components/catalog/master-catalog-browser";
import { LIQUID_SCAN_PATH } from "@/lib/app-routes";
import type { CatalogScanPrefill } from "@/lib/scan/catalog-bridge";
import { cn } from "@/lib/cn";

/**
 * Persistent master catalog — stays mounted once opened so sets/cards/state
 * are not refetched on every open.
 */
export function MasterCatalogSessionPanel({
  open,
  onClose,
  onCatalogScanPrefill,
  className,
}: {
  open: boolean;
  onClose: () => void;
  onCatalogScanPrefill?: (prefill: CatalogScanPrefill) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "sc-catalog-embed-panel sc-catalog-session-panel flex w-full min-w-0 max-w-full flex-none flex-col overflow-visible rounded-xl border border-amber-500/20 sc-glass-raised",
        open && "sc-chat-output-panel sc-chat-output-panel--stacked sc-catalog-session-panel--open",
        !open && "hidden",
        className,
      )}
      aria-hidden={!open}
    >
      <div className="sc-catalog-embed-panel__header flex shrink-0 items-center justify-between gap-3 border-b border-white/8 bg-[rgb(8,10,14)]/95 px-3 py-2.5 backdrop-blur-md max-lg:px-3 max-lg:py-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 shrink-0 text-amber-300" aria-hidden />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-200/90 max-lg:text-[11px]">
              Master catalog
            </p>
          </div>
          <p className="mt-1 hidden text-[11px] leading-relaxed text-slate-500 lg:block">
            Pick a set, tap a card, then <span className="text-amber-200/90">Scan this card</span> to load
            it into your session.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-white/5 touch-manipulation max-lg:h-11 max-lg:w-11"
          aria-label="Close catalog"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="liquid-catalog-embed flex flex-none flex-col overflow-visible px-2 py-1.5 sm:px-3 sm:py-2 lg:px-3.5 lg:py-3">
        <MasterCatalogBrowser
          embedded
          scanTargetPath={LIQUID_SCAN_PATH}
          onScanPrefill={onCatalogScanPrefill}
        />
      </div>
    </div>
  );
}
