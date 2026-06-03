"use client";

import { BookOpen, Calculator, X } from "lucide-react";
import { EbayEndingSoonPanel } from "@/components/scanner-chat/ebay-ending-soon-panel";
import { SlabzRipPanel } from "@/components/scanner-chat/slabz-rip-panel";
import { PgtArcadePartnerPanel } from "@/components/scanner-chat/pgt-arcade-partner-panel";
import { PgtYoutubePlayerPanel } from "@/components/scanner-chat/pgt-youtube-player-panel";
import { LiveMarketTickerPanel } from "@/components/scanner-chat/live-market-ticker-panel";
import { CollectorVendorCalculator } from "@/components/scanner-chat/collector-vendor-calculator";
import { CompanionPanel } from "@/components/companion/companion-panel";
import { MasterCatalogBrowser } from "@/components/catalog/master-catalog-browser";
import type { CompanionController } from "@/hooks/use-companion";
import { LIQUID_SCAN_PATH } from "@/lib/app-routes";
import type { CatalogScanPrefill } from "@/lib/scan/catalog-bridge";
import type { SlabzPack, SlabzRipRecord } from "@/lib/slabz/types";
import type { ChatOutputKind } from "@/lib/scanner-chat/types";
import { cn } from "@/lib/cn";

export function LiquidChatOutputPanel({
  kind,
  companion,
  onCatalogScanPrefill,
  onOpenSlabzRipInScan,
  calculatorBaseAmount = 0,
  calculatorCardCount = 0,
  onDismiss,
  className,
}: {
  kind: ChatOutputKind;
  companion?: CompanionController;
  onCatalogScanPrefill?: (prefill: CatalogScanPrefill) => void;
  onOpenSlabzRipInScan?: (rip: SlabzRipRecord, pack: SlabzPack | null) => void;
  calculatorBaseAmount?: number;
  calculatorCardCount?: number;
  onDismiss?: () => void;
  className?: string;
}) {
  if (kind === "calculator") {
    return (
      <div
        className={cn(
          "sc-chat-output-panel sc-chat-output-panel--stacked flex w-full min-w-0 max-w-full flex-col overflow-hidden rounded-xl border border-emerald-500/20 sc-glass-raised",
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

  if (kind === "live-market") {
    return (
      <div
        className={cn(
          "sc-live-market-embed-panel sc-chat-output-panel sc-chat-output-panel--stacked flex w-full min-w-0 max-w-full flex-col overflow-hidden rounded-xl border border-sky-500/25 sc-glass-raised",
          className,
        )}
      >
        <LiveMarketTickerPanel
          onCatalogScanPrefill={onCatalogScanPrefill}
          onDismiss={onDismiss}
        />
      </div>
    );
  }

  if (kind === "ebay-ending") {
    return (
      <div
        className={cn(
          "sc-ebay-ending-embed-panel sc-chat-output-panel sc-chat-output-panel--stacked flex w-full min-w-0 max-w-full flex-col overflow-hidden rounded-xl border border-rose-500/25 sc-glass-raised",
          className,
        )}
      >
        <EbayEndingSoonPanel onDismiss={onDismiss} className="min-h-0 flex-1" />
      </div>
    );
  }

  if (kind === "pgt-youtube") {
    return (
      <div
        className={cn(
          "sc-pgt-youtube-embed-panel sc-chat-output-panel sc-chat-output-panel--stacked flex w-full min-w-0 max-w-full flex-col overflow-hidden rounded-xl border border-violet-500/25 sc-glass-raised",
          className,
        )}
      >
        <PgtYoutubePlayerPanel onDismiss={onDismiss} />
      </div>
    );
  }

  if (kind === "pgt-arcade") {
    return (
      <div
        className={cn(
          "sc-pgt-arcade-embed-panel sc-assistant-wide-embed sc-chat-output-panel sc-chat-output-panel--stacked flex w-full min-w-0 max-w-full flex-col overflow-hidden rounded-xl border border-indigo-500/25 sc-glass-raised",
          className,
        )}
      >
        <PgtArcadePartnerPanel onDismiss={onDismiss} />
      </div>
    );
  }

  if (kind === "slabz-rip") {
    return (
      <div
        className={cn(
          "sc-slabz-rip-embed-panel sc-assistant-wide-embed sc-chat-output-panel sc-chat-output-panel--stacked flex w-full min-w-0 max-w-full flex-col overflow-hidden rounded-xl border border-cyan-400/25 sc-glass-raised",
          className,
        )}
      >
        <SlabzRipPanel
          onDismiss={onDismiss}
          onOpenRipInScan={onOpenSlabzRipInScan}
          className="min-h-0 flex-1"
        />
      </div>
    );
  }

  if (kind === "companion") {
    if (!companion) return null;
    return (
      <div
        className={cn(
          "sc-companion-embed-panel sc-assistant-wide-embed sc-chat-output-panel sc-chat-output-panel--stacked flex w-full min-w-0 max-w-full flex-col overflow-hidden rounded-xl border border-violet-500/25 sc-glass-raised",
          className,
        )}
      >
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3 sm:px-4 sm:py-4 scanner-chat-scrollbar">
          <CompanionPanel layout="tcg" onDismiss={onDismiss} {...companion} />
        </div>
      </div>
    );
  }

  if (!onCatalogScanPrefill) return null;

  return (
    <div
      className={cn(
        "sc-catalog-embed-panel sc-chat-output-panel flex w-full min-w-0 max-w-full flex-col overflow-hidden rounded-xl border border-amber-500/20 sc-glass-raised lg:min-h-[min(70vh,680px)] lg:max-h-[min(calc(100dvh-10rem),940px)]",
        className,
      )}
    >
      <div className="sc-catalog-embed-panel__header flex shrink-0 items-center justify-between gap-3 border-b border-white/8 bg-[rgb(8,10,14)]/95 px-3 py-2.5 backdrop-blur-md max-lg:px-3 max-lg:py-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 shrink-0 text-amber-300 max-lg:h-[1.125rem] max-lg:w-[1.125rem]" aria-hidden />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-200/90 max-lg:text-[11px]">
              Master catalog
            </p>
          </div>
          <p className="mt-1 hidden text-[11px] leading-relaxed text-slate-500 lg:block">
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
      <div className="liquid-catalog-embed flex min-h-0 flex-1 flex-col overflow-hidden px-2 py-1.5 sm:px-3 sm:py-2 max-lg:px-2 max-lg:py-1.5 lg:px-3.5 lg:py-3">
        <MasterCatalogBrowser
          embedded
          scanTargetPath={LIQUID_SCAN_PATH}
          onScanPrefill={onCatalogScanPrefill}
        />
      </div>
    </div>
  );
}
