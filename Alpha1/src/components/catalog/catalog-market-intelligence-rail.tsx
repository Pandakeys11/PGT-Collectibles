"use client";

import { TrendingUp } from "lucide-react";
import { SetMarketPulseStrip } from "@/components/market/set-market-pulse-strip";
import { MarketMoversSectionHeader } from "@/components/market/market-movers-explainer";
import { SET_MOVER_RAIL_COLUMN_SIZE } from "@/lib/catalog/set-insight-limits";
import type { SetInsightCardSource } from "@/lib/catalog/set-insight-utils";
import { cn } from "@/lib/cn";

/**
 * Master catalog — set-scoped market pulse (7-day movers).
 * Separate from Set insight (research, chase narrative, top value).
 */
export function CatalogMarketIntelligenceRail({
  setId,
  setName,
  cards,
  onSelectCard,
  className,
}: {
  setId: string;
  setName: string;
  cards?: SetInsightCardSource[];
  onSelectCard?: (catalogId: string) => void;
  className?: string;
}) {
  if (!setId.trim()) return null;

  return (
    <aside
      className={cn(
        "sc-catalog-market-intelligence-rail desk-surface-raised flex min-h-0 flex-col overflow-hidden border border-sky-500/25 sc-glass-raised",
        className,
      )}
      aria-label={`${setName} market intelligence`}
    >
      <header className="shrink-0 border-b border-sky-500/15 bg-gradient-to-r from-sky-500/[0.08] to-transparent px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <TrendingUp className="h-4 w-4 shrink-0 text-sky-300" aria-hidden />
          <div className="min-w-0">
            <h3 className="truncate text-xs font-semibold text-sky-100">Market intelligence</h3>
            <p className="truncate text-[10px] text-muted">{setName}</p>
          </div>
        </div>
        <p className="mt-1.5 text-[9px] leading-snug text-muted">
          Price movers for the active set · refreshes when you change sets
        </p>
      </header>

      <div className="sc-catalog-market-intelligence-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 scanner-chat-scrollbar">
        <section className="mb-2 border-b border-sky-500/10 pb-2">
          <MarketMoversSectionHeader />
        </section>
        <SetMarketPulseStrip
          key={setId}
          setId={setId}
          setName={setName}
          cards={cards}
          onSelectCard={onSelectCard}
          moverColumnSize={SET_MOVER_RAIL_COLUMN_SIZE}
          compact
          embeddedInRail
        />
      </div>
    </aside>
  );
}
