"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bookmark,
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
import { ScanResultsMobileList } from "./scan-results-sheet";
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
            "flex flex-col items-center gap-1 rounded-xl border py-2 text-[10px]",
            isPro
              ? "border-white/8 text-muted touch-manipulation"
              : "border-warning/25 bg-warning/5 text-warning/90 touch-manipulation",
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
  cards,
  specimens = [],
  cardHandlers,
  selectedSpecimen,
  selectedSpecimenId,
  enrichingSpecimenId,
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
  onOpenMasterCatalog?: () => void;
}) {
  const reviewCount = cards.filter((c) => c.status === "review").length;
  const [drawerTab, setDrawerTab] = useState<"detail" | "list">("detail");

  useEffect(() => {
    if (open) setDrawerTab("detail");
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
      {open && summary ? (
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
            aria-label="Scan results"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 34, stiffness: 400 }}
            className="sc-mobile-drawer-sheet fixed inset-x-0 bottom-0 z-[100] flex max-h-[94dvh] flex-col rounded-t-2xl border-t border-white/10 sc-glass lg:hidden"
          >
            <div className="flex shrink-0 items-center justify-center pt-2 pb-1">
              <div className="h-1 w-10 rounded-full bg-white/20" aria-hidden />
            </div>

            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/6 px-4 pb-3">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-primary">Scan results</h2>
                <p className="truncate text-[10px] text-muted">
                  {summary.totalDetected} cards · ${summary.estimatedTotal.toLocaleString()} FMV
                  {summary.needsReview > 0
                    ? ` · ${summary.needsReview} need review`
                    : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-white/5 touch-manipulation"
                aria-label="Close results"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

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
                onClick={() => setDrawerTab("list")}
                className={cn(
                  "min-h-9 flex-1 rounded-lg text-xs font-medium transition touch-manipulation",
                  drawerTab === "list"
                    ? "bg-success/15 text-primary ring-1 ring-success/30"
                    : "text-muted hover:bg-white/5",
                )}
              >
                Sheet ({cards.length})
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden scanner-chat-scrollbar">
              {drawerTab === "detail" && cards.length > 0 ? (
                <div className="border-b border-white/6 px-3 py-3">
                  <ExtractedCardsCarousel
                    cards={cards}
                    selectedSpecimenId={selectedSpecimenId}
                    onSelectSpecimen={onSelectSpecimen}
                    onCorrectMatch={cardHandlers?.onCorrectMatch}
                    onWrongMatch={cardHandlers?.onWrongMatch}
                    onViewComps={cardHandlers?.onViewComps}
                    onAddToCollection={cardHandlers?.onAddToCollection}
                    onExclude={cardHandlers?.onExclude}
                    className="max-w-none"
                  />
                </div>
              ) : null}
              {drawerTab === "list" && specimens.length > 0 ? (
                <div className="p-3">
                  <ScanResultsMobileList
                    specimens={specimens}
                    selectedSpecimenId={selectedSpecimenId}
                    onRowSelect={(id) => {
                      onSelectSpecimen(id);
                      setDrawerTab("detail");
                    }}
                  />
                </div>
              ) : drawerTab === "detail" ? (
              <ScanIntelligencePanel
                layoutMode="drawer"
                summary={summary}
                cards={cards}
                selectedSpecimen={selectedSpecimen}
                selectedSpecimenId={selectedSpecimenId}
                enrichingSpecimenId={enrichingSpecimenId}
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
                onOpenMasterCatalog={onOpenMasterCatalog}
                className="min-h-0 border-0 bg-transparent shadow-none"
              />
              ) : null}
            </div>

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
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
