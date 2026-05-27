"use client";

import { BookOpen, Calculator, Sparkles, X } from "lucide-react";
import { CollectorVendorCalculator } from "@/components/scanner-chat/collector-vendor-calculator";
import { CompanionPanel } from "@/components/companion/companion-panel";
import { MasterCatalogBrowser } from "@/components/catalog/master-catalog-browser";
import type { CompanionController } from "@/hooks/use-companion";
import { LIQUID_SCAN_PATH } from "@/lib/app-routes";
import type { CatalogScanPrefill } from "@/lib/scan/catalog-bridge";
import type { ChatOutputKind } from "@/lib/scanner-chat/types";
import { cn } from "@/lib/cn";

export function LiquidChatOutputPanel({
  kind,
  companion,
  onCatalogScanPrefill,
  calculatorBaseAmount = 0,
  calculatorCardCount = 0,
  onDismiss,
  className,
}: {
  kind: ChatOutputKind;
  companion?: CompanionController;
  onCatalogScanPrefill?: (prefill: CatalogScanPrefill) => void;
  calculatorBaseAmount?: number;
  calculatorCardCount?: number;
  onDismiss?: () => void;
  className?: string;
}) {
  if (kind === "calculator") {
    return (
      <div
        className={cn(
          "sc-chat-output-panel flex w-full min-w-0 max-w-full max-h-[min(85dvh,560px)] flex-col overflow-hidden rounded-xl border border-emerald-500/20 sc-glass-raised lg:min-h-[min(40vh,420px)] lg:max-h-[min(calc(100dvh-11rem),640px)]",
          className,
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/8 bg-white/[0.02] px-3 py-2">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-emerald-300" aria-hidden />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-200/90">
              Deal calculator
            </p>
          </div>
          {onDismiss ? (
            <button
              type="button"
              onClick={onDismiss}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-white/5"
              aria-label="Close calculator"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2.5 sm:p-3 scanner-chat-scrollbar">
          <CollectorVendorCalculator
            embedded
            baseAmount={calculatorBaseAmount}
            cardCount={calculatorCardCount}
            baseLabel={calculatorBaseAmount > 0 ? "Session FMV" : "Total value"}
          />
        </div>
      </div>
    );
  }

  if (kind === "companion") {
    if (!companion) return null;
    return (
      <div
        className={cn(
          "sc-chat-output-panel flex w-full min-w-0 max-w-full max-h-[min(85dvh,640px)] flex-col overflow-hidden rounded-xl border border-violet-500/20 sc-glass-raised lg:min-h-[min(52vh,480px)] lg:max-h-[min(calc(100dvh-11rem),720px)]",
          className,
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/8 bg-white/[0.02] px-3 py-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-300" aria-hidden />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-200/90">
              PGT Companion
            </p>
          </div>
          {onDismiss ? (
            <button
              type="button"
              onClick={onDismiss}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-white/5"
              aria-label="Close companion"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2.5 sm:p-3 scanner-chat-scrollbar">
          <CompanionPanel layout="mobile" {...companion} />
        </div>
      </div>
    );
  }

  if (!onCatalogScanPrefill) return null;

  return (
    <div
      className={cn(
        "sc-catalog-embed-panel sc-chat-output-panel flex w-full min-w-0 max-w-full max-h-[min(88dvh,820px)] flex-col overflow-hidden rounded-xl border border-amber-500/20 sc-glass-raised max-lg:max-h-[min(94dvh,900px)] lg:min-h-[min(68vh,640px)] lg:max-h-[min(calc(100dvh-11rem),920px)]",
        className,
      )}
    >
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/8 bg-[rgb(8,10,14)]/95 px-3 py-2.5 backdrop-blur-md max-lg:px-3.5 max-lg:py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 shrink-0 text-amber-300 max-lg:h-[1.125rem] max-lg:w-[1.125rem]" aria-hidden />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-200/90 max-lg:text-[11px]">
              Master catalog
            </p>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500 max-lg:text-xs">
            Pick a set, tap a card, then <span className="text-amber-200/90">Scan this card</span> to load
            it into your session.
          </p>
        </div>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-white/5 touch-manipulation max-lg:h-11 max-lg:w-11"
            aria-label="Close catalog"
          >
            <X className="h-5 w-5 max-lg:h-[1.125rem] max-lg:w-[1.125rem]" />
          </button>
        ) : null}
      </div>
      <div className="liquid-catalog-embed min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-2.5 sm:px-3 sm:py-3 scanner-chat-scrollbar max-lg:px-3 max-lg:py-3 lg:px-4 lg:py-3.5">
        <MasterCatalogBrowser
          embedded
          scanTargetPath={LIQUID_SCAN_PATH}
          onScanPrefill={onCatalogScanPrefill}
        />
      </div>
    </div>
  );
}
