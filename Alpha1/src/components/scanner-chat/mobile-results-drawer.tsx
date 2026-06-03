"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bookmark,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  FileText,
  Lock,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import Link from "next/link";
import type { ScanSpecimen } from "@/hooks/use-scan-session";
import type { CatalogCandidate } from "@/lib/scan/schemas";
import type { CardMatch, ScanSummary } from "@/lib/scanner-chat/types";
import { ExtractedCardsCarousel } from "./extracted-cards-carousel";
import { ScanResultsSheet } from "./scan-results-sheet";
import type { MarketIntelIdleAction } from "./market-intelligence-idle-showcase";
import { ScanIntelligencePanel } from "./scan-intelligence-panel";
import type { CardInteractionHandlers } from "./chat-message";
import { cn } from "@/lib/cn";

function MobileDrawerFooter({
  summary,
  reviewCount,
  saving,
  saveStatus,
  loadedSessionId,
  isPro,
  onSaveCollection,
  onReviewUncertain,
  onExport,
  onNewScan,
}: {
  summary: ScanSummary | null;
  reviewCount: number;
  saving?: boolean;
  saveStatus: string | null;
  loadedSessionId?: string | null;
  isPro?: boolean;
  onSaveCollection: () => void;
  onReviewUncertain: () => void;
  onExport: (format: string) => void;
  onNewScan: () => void;
}) {
  return (
    <div className="shrink-0 border-t border-white/8 bg-panel/95 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
      {saveStatus ? (
        <p className="mb-2 text-center text-[10px] text-success/90">{saveStatus}</p>
      ) : null}
      <button
        type="button"
        onClick={onSaveCollection}
        disabled={!summary || saving}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500/15 py-2.5 text-xs font-medium text-sky-100 ring-1 ring-sky-500/25 disabled:opacity-40"
      >
        <Bookmark className="h-3.5 w-3.5" />
        {saving ? "Saving…" : loadedSessionId ? "Update saved scan" : "Save scan"}
      </button>
      {reviewCount > 0 ? (
        <button
          type="button"
          onClick={onReviewUncertain}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500/10 py-2 text-xs text-amber-200 ring-1 ring-amber-500/20"
        >
          <Search className="h-3.5 w-3.5" />
          Review uncertain ({reviewCount})
        </button>
      ) : null}
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        <button
          type="button"
          onClick={() => onExport("csv")}
          className="flex flex-col items-center gap-1 rounded-xl border border-white/8 py-2 text-[10px] text-muted touch-manipulation"
        >
          <FileText className="h-4 w-4" />
          CSV
        </button>
        <button
          type="button"
          onClick={() => onExport("json")}
          className="flex flex-col items-center gap-1 rounded-xl border border-white/8 py-2 text-[10px] text-muted touch-manipulation"
        >
          <FileSpreadsheet className="h-4 w-4" />
          JSON
        </button>
        <button
          type="button"
          onClick={() => onExport("pdf")}
          className={cn(
            "flex flex-col items-center gap-1 rounded-xl border py-2 text-[10px] touch-manipulation",
            isPro
              ? "border-white/8 text-muted"
              : "border-warning/25 bg-warning/5 text-warning/90",
          )}
        >
          {isPro ? <FileText className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
          PDF
        </button>
      </div>
      {!isPro ? (
        <p className="mt-1.5 text-center text-[10px] text-amber-200/80">
          Premium appraisals on{" "}
          <Link href="/usage" className="underline">
            Pro
          </Link>
        </p>
      ) : null}
      <button
        type="button"
        onClick={onNewScan}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-white/8 py-2 text-xs text-muted touch-manipulation"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        New scan
      </button>
    </div>
  );
}

export function MobileResultsDrawer({
  open,
  onClose,
  summary,
  intelOnly = false,
  cards,
  specimens = [],
  cardHandlers,
  selectedSpecimen,
  selectedSpecimenId,
  enrichingSpecimenId,
  catalogEnriching = false,
  marketEnriching = false,
  onSelectSpecimen,
  onConfirmCandidate,
  onRejectCandidate,
  onRefreshCatalogCandidates,
  refreshingCatalogCandidates,
  onExport,
  onSaveCollection,
  saveStatus,
  saving,
  loadedSessionId,
  historyRefreshKey,
  onNewScan,
  compsSectionRef,
  onReviewUncertain,
  onRequestAdjustCrop,
  onRescanSpecimen,
  rescanningId,
  isPro,
  onOpenMasterCatalog,
  onIdleAction,
  digitalScanAsset = null,
  onDownloadDigitalScan,
}: {
  open: boolean;
  onClose: () => void;
  summary: ScanSummary | null;
  cards: CardMatch[];
  specimens?: ScanSpecimen[];
  cardHandlers?: CardInteractionHandlers;
  selectedSpecimen: ScanSpecimen | null;
  selectedSpecimenId: string | null;
  enrichingSpecimenId: string | null;
  catalogEnriching?: boolean;
  marketEnriching?: boolean;
  onSelectSpecimen: (id: string) => void;
  onConfirmCandidate: (candidate: CatalogCandidate) => void;
  onRejectCandidate: (catalogId: string) => void;
  onRefreshCatalogCandidates?: () => void;
  refreshingCatalogCandidates?: boolean;
  onExport: (format: string) => void;
  onSaveCollection: () => void;
  saveStatus: string | null;
  saving?: boolean;
  loadedSessionId?: string | null;
  historyRefreshKey?: number;
  onNewScan: () => void;
  compsSectionRef?: React.RefObject<HTMLDivElement>;
  onReviewUncertain: () => void;
  onRequestAdjustCrop?: () => void;
  onRescanSpecimen?: () => void;
  rescanningId?: string | null;
  isPro?: boolean;
  onOpenMasterCatalog?: (specimenId: string) => void;
  onIdleAction?: (action: MarketIntelIdleAction) => void;
  digitalScanAsset?: import("@/lib/digital-scan/types").DigitalScanAsset | null;
  onDownloadDigitalScan?: () => void;
  /** Idle daily desk — no scan session required. */
  intelOnly?: boolean;
}) {
  const reviewCount = cards.filter((c) => c.status === "review").length;
  const [drawerTab, setDrawerTab] = useState<"detail" | "sheet">("detail");
  const [expanded, setExpanded] = useState(false);
  const sessionMode = Boolean(summary && !intelOnly);

  useEffect(() => {
    if (open) {
      setDrawerTab("detail");
      setExpanded(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (sessionMode || intelOnly) ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="sc-mobile-drawer-backdrop fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={intelOnly ? "Market intelligence desk" : "Scan results"}
            data-expanded={expanded ? "true" : "false"}
            data-drawer-tab={drawerTab}
            data-intel-only={intelOnly ? "true" : "false"}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 34, stiffness: 400 }}
            className={cn(
              "sc-mobile-drawer-sheet sc-glass fixed inset-x-0 bottom-0 z-[100] flex flex-col border-t border-white/10 lg:hidden",
              expanded ? "top-0 max-h-[100dvh] rounded-none" : "max-h-[94dvh] rounded-t-2xl",
            )}
          >
            <div className="flex shrink-0 items-center justify-center pt-2 pb-1">
              <div className="h-1 w-10 rounded-full bg-white/20" aria-hidden />
            </div>

            <div className="flex shrink-0 items-start justify-between gap-2 border-b border-white/6 px-4 pb-3">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-primary">Market intelligence</h2>
                <p className="mt-0.5 text-[10px] leading-snug text-muted">
                  {intelOnly ? (
                    <>Daily TCG desk · live pulse · platform shortcuts</>
                  ) : summary ? (
                    <>
                      {summary.totalDetected} cards · ${summary.estimatedTotal.toLocaleString()}{" "}
                      session FMV
                      {summary.needsReview > 0 ? ` · ${summary.needsReview} need review` : ""}
                    </>
                  ) : null}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="flex h-9 items-center gap-1 rounded-lg px-2 text-[10px] font-medium text-muted hover:bg-white/5 touch-manipulation"
                  aria-expanded={expanded}
                >
                  {expanded ? (
                    <>
                      <ChevronDown className="h-3.5 w-3.5" />
                      Collapse
                    </>
                  ) : (
                    <>
                      <ChevronUp className="h-3.5 w-3.5" />
                      Expand
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-white/5 touch-manipulation"
                  aria-label="Close results"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {sessionMode ? (
              <div className="flex shrink-0 gap-1 border-b border-white/6 px-3 py-2">
                <button
                  type="button"
                  onClick={() => setDrawerTab("detail")}
                  className={cn(
                    "min-h-9 flex-1 rounded-lg text-xs font-medium transition touch-manipulation",
                    drawerTab === "detail"
                      ? "bg-success/15 text-primary ring-1 ring-success/30"
                      : "text-muted hover:bg-white/5",
                  )}
                >
                  Card detail
                </button>
                <button
                  type="button"
                  onClick={() => setDrawerTab("sheet")}
                  className={cn(
                    "min-h-9 flex-1 rounded-lg text-xs font-medium transition touch-manipulation",
                    drawerTab === "sheet"
                      ? "bg-success/15 text-primary ring-1 ring-success/30"
                      : "text-muted hover:bg-white/5",
                  )}
                >
                  Scan sheet ({cards.length})
                </button>
              </div>
            ) : null}

            <div
              className={cn(
                "sc-mobile-drawer-body min-h-0 flex-1",
                sessionMode && drawerTab === "sheet"
                  ? "flex flex-col overflow-hidden"
                  : "overflow-y-auto overflow-x-hidden scanner-chat-scrollbar overscroll-contain",
              )}
            >
              {sessionMode && drawerTab === "detail" && cards.length > 0 ? (
                <div className="border-b border-white/6 px-3 py-3">
                  <ExtractedCardsCarousel
                    cards={cards}
                    specimens={specimens}
                    selectedSpecimenId={selectedSpecimenId}
                    onSelectSpecimen={onSelectSpecimen}
                    onCorrectMatch={cardHandlers?.onCorrectMatch}
                    onWrongMatch={cardHandlers?.onWrongMatch}
                    onViewComps={cardHandlers?.onViewComps}
                    onAddToCollection={cardHandlers?.onAddToCollection}
                    onExclude={cardHandlers?.onExclude}
                    onConfirmCatalogCandidate={cardHandlers?.onConfirmCatalogCandidate}
                    onRejectCatalogCandidate={cardHandlers?.onRejectCatalogCandidate}
                    onRefreshCatalogCandidates={cardHandlers?.onRefreshCatalogCandidates}
                    onOpenMasterCatalog={cardHandlers?.onOpenMasterCatalog}
                    catalogRefreshingId={cardHandlers?.catalogRefreshingId}
                    catalogBusy={cardHandlers?.catalogBusy}
                    className="max-w-none"
                  />
                </div>
              ) : null}
              {sessionMode && drawerTab === "sheet" && specimens.length > 0 ? (
                <div className="flex min-h-0 flex-1 flex-col p-3 pt-2">
                  <ScanResultsSheet
                    specimens={specimens}
                    fillHeight
                    selectedSpecimenId={selectedSpecimenId}
                    onRowSelect={(id) => {
                      onSelectSpecimen(id);
                      setDrawerTab("detail");
                    }}
                  />
                </div>
              ) : sessionMode && drawerTab === "detail" ? (
                <ScanIntelligencePanel
                  layoutMode="drawer"
                  summary={summary}
                  cards={cards}
                  selectedSpecimen={selectedSpecimen}
                  selectedSpecimenId={selectedSpecimenId}
                  enrichingSpecimenId={enrichingSpecimenId}
                  catalogEnriching={catalogEnriching}
                  marketEnriching={marketEnriching}
                  onSelectSpecimen={onSelectSpecimen}
                  onConfirmCandidate={onConfirmCandidate}
                  onRejectCandidate={onRejectCandidate}
                  onRefreshCatalogCandidates={onRefreshCatalogCandidates}
                  refreshingCatalogCandidates={refreshingCatalogCandidates}
                  onExport={onExport}
                  onNewScan={onNewScan}
                  onReviewUncertain={onReviewUncertain}
                  onSaveCollection={onSaveCollection}
                  onRequestAdjustCrop={onRequestAdjustCrop}
                  onRescanSpecimen={onRescanSpecimen}
                  rescanningId={rescanningId}
                  saveStatus={saveStatus}
                  saving={saving}
                  loadedSessionId={loadedSessionId}
                  historyRefreshKey={historyRefreshKey}
                  compsSectionRef={compsSectionRef}
                  isPro={isPro}
                  onOpenMasterCatalog={
                    onOpenMasterCatalog && selectedSpecimenId
                      ? () => onOpenMasterCatalog(selectedSpecimenId)
                      : undefined
                  }
                  onIdleAction={onIdleAction}
                  digitalScanAsset={digitalScanAsset}
                  onDownloadDigitalScan={onDownloadDigitalScan}
                  className="sc-mobile-drawer-intel min-h-0 border-0 bg-transparent shadow-none"
                />
              ) : intelOnly ? (
                <ScanIntelligencePanel
                  layoutMode="drawer"
                  summary={null}
                  cards={[]}
                  selectedSpecimen={null}
                  selectedSpecimenId={null}
                  enrichingSpecimenId={null}
                  onSelectSpecimen={() => {}}
                  onConfirmCandidate={() => {}}
                  onRejectCandidate={() => {}}
                  onExport={() => {}}
                  onNewScan={() => {}}
                  onReviewUncertain={() => {}}
                  onSaveCollection={() => {}}
                  saveStatus={null}
                  onIdleAction={onIdleAction}
                  className="sc-mobile-drawer-intel sc-mobile-drawer-intel--idle min-h-0 border-0 bg-transparent shadow-none"
                />
              ) : null}
            </div>

            {sessionMode ? (
              <MobileDrawerFooter
              summary={summary}
              reviewCount={reviewCount}
              saving={saving}
              saveStatus={saveStatus}
              loadedSessionId={loadedSessionId}
              isPro={isPro}
              onSaveCollection={onSaveCollection}
              onReviewUncertain={onReviewUncertain}
              onExport={onExport}
              onNewScan={onNewScan}
            />
            ) : (
              <div className="shrink-0 border-t border-white/8 bg-panel/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex w-full min-h-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-xs font-medium text-slate-300 touch-manipulation active:scale-[0.99]"
                >
                  Close desk
                </button>
              </div>
            )}
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
