"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { CardMatchResult } from "@/components/scanner-chat/card-match-result";
import { CatalogMatchQuickPick } from "@/components/scanner-chat/catalog-match-quick-pick";
import type { ScanSpecimen } from "@/hooks/use-scan-session";
import type { CatalogCandidate } from "@/lib/scan/schemas";
import type { LiveScanResult } from "@/lib/pokegrade/types";
import { specimenToCardMatch } from "@/lib/scanner-chat/specimen-present";
import { cn } from "@/lib/cn";

/** Slide-up full card match panel while camera stays open. */
export function LiveScanResultSheet({
  result,
  onAdd,
  adding,
  loadingMarket,
  marketReady,
  catalogBusy,
  onConfirmCatalogCandidate,
  onRejectCatalogCandidate,
  onRefreshCatalogCandidates,
  className,
}: {
  result: LiveScanResult | null;
  onAdd: () => void;
  adding?: boolean;
  loadingMarket?: boolean;
  marketReady?: boolean;
  catalogBusy?: boolean;
  onConfirmCatalogCandidate?: (specimenId: string, candidate: CatalogCandidate) => void;
  onRejectCatalogCandidate?: (specimenId: string, catalogId: string) => void;
  onRefreshCatalogCandidates?: (specimenId: string) => void;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(true);
  const card = useMemo(
    () => (result ? specimenToCardMatch(result.specimen, 0) : null),
    [result],
  );
  const specimen = useMemo(
    (): ScanSpecimen | null => (result ? (result.specimen as ScanSpecimen) : null),
    [result],
  );

  return (
    <AnimatePresence>
      {result && card ? (
        <motion.div
          key={result.previewUrl}
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 340 }}
          className={cn(
            "sc-live-scan-result-sheet pointer-events-auto absolute inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-40 mx-auto max-h-[min(52vh,26rem)] w-full max-w-md px-2",
            className,
          )}
        >
          <div className="flex max-h-[inherit] flex-col overflow-hidden rounded-2xl border border-emerald-500/30 bg-[rgb(5,8,14)]/95 shadow-[0_-8px_40px_rgb(0_0_0/0.55)] backdrop-blur-xl">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex shrink-0 items-center justify-between gap-2 border-b border-white/8 px-3 py-2 text-left"
            >
              <div className="min-w-0">
                <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-emerald-300">
                  {loadingMarket ? "Match found" : "Market ready"}
                </p>
                <p className="truncate text-xs font-medium text-white">{card.name}</p>
              </div>
              {loadingMarket ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-cyan-300" aria-hidden />
              ) : expanded ? (
                <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
              ) : (
                <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
              )}
            </button>
            {expanded ? (
              <div className="min-h-0 flex-1 overflow-y-auto scanner-chat-scrollbar p-2">
                {onConfirmCatalogCandidate && onRejectCatalogCandidate ? (
                  <CatalogMatchQuickPick
                    specimen={specimen}
                    busy={catalogBusy}
                    refreshing={catalogBusy}
                    onConfirm={onConfirmCatalogCandidate}
                    onReject={onRejectCatalogCandidate}
                    onRefreshCandidates={onRefreshCatalogCandidates}
                    className="mb-2"
                  />
                ) : null}
                {loadingMarket && !marketReady ? (
                  <p className="flex items-center gap-2 px-1 py-3 text-[11px] text-slate-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-300" />
                    Fetching FMV and comps…
                  </p>
                ) : null}
                <CardMatchResult card={card} index={0} stackPricing />
              </div>
            ) : null}
            <div className="shrink-0 border-t border-white/8 p-2">
              <button
                type="button"
                disabled={adding || loadingMarket || !marketReady}
                onClick={onAdd}
                className="w-full rounded-xl bg-emerald-500/20 py-2.5 text-xs font-semibold text-emerald-100 ring-1 ring-emerald-500/35 transition hover:bg-emerald-500/30 disabled:opacity-50"
              >
                {adding ? "Adding…" : loadingMarket ? "Loading market…" : "Add to session"}
              </button>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
