"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trackCompanionQuest } from "@/lib/companion/quest-tracker";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bookmark,
  FileSpreadsheet,
  FileText,
  Lock,
  RefreshCw,
  Search,
} from "lucide-react";
import Link from "next/link";
import { EvidenceRail } from "@/components/scan-panels/evidence-rail";
import { CatalogMatchPanel } from "@/components/scan-panels/catalog-match-panel";
import { CollectorCalculatorCollapsible } from "@/components/scanner-chat/collector-calculator-collapsible";
import { SpecimenMarketHub } from "@/components/scanner-chat/specimen-market-hub";
import type { ScanSpecimen } from "@/hooks/use-scan-session";
import type { ExtractedCard } from "@/lib/scan/schemas";
import type { CatalogCandidate } from "@/lib/scan/schemas";
import type { CardMatch, ScanSummary } from "@/lib/scanner-chat/types";
import { cn } from "@/lib/cn";

export function ScanIntelligencePanel({
  summary,
  cards,
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
  onNewScan,
  onReviewUncertain,
  onSaveCollection,
  onRequestAdjustCrop,
  onRescanSpecimen,
  onUpdateSpecimen,
  onCommitSpecimenEdit,
  rescanningId,
  saveStatus,
  saving,
  loadedSessionId,
  historyRefreshKey,
  compsSectionRef,
  isPro,
  onOpenMasterCatalog,
  layoutMode = "sidebar",
  className,
  digitalScanAsset = null,
  onDownloadDigitalScan,
}: {
  summary: ScanSummary | null;
  cards: CardMatch[];
  selectedSpecimen: ScanSpecimen | null;
  selectedSpecimenId: string | null;
  enrichingSpecimenId: string | null;
  /** Bulk catalog phase for the current scan session. */
  catalogEnriching?: boolean;
  /** Background market comps load after catalog. */
  marketEnriching?: boolean;
  onSelectSpecimen: (id: string) => void;
  onConfirmCandidate: (candidate: CatalogCandidate) => void;
  onRejectCandidate: (catalogId: string) => void;
  onRefreshCatalogCandidates?: () => void;
  refreshingCatalogCandidates?: boolean;
  onExport: (format: string) => void;
  onNewScan: () => void;
  onReviewUncertain: () => void;
  onSaveCollection: () => void;
  onRequestAdjustCrop?: () => void;
  onRescanSpecimen?: () => void;
  onUpdateSpecimen?: (patch: Partial<ExtractedCard>) => void;
  onCommitSpecimenEdit?: () => void;
  rescanningId?: string | null;
  saveStatus: string | null;
  saving?: boolean;
  loadedSessionId?: string | null;
  historyRefreshKey?: number;
  compsSectionRef?: React.RefObject<HTMLDivElement>;
  isPro?: boolean;
  onOpenMasterCatalog?: () => void;
  /** Sidebar on desktop; drawer uses a single scroll column with external footer. */
  layoutMode?: "sidebar" | "drawer";
  className?: string;
  digitalScanAsset?: import("@/lib/digital-scan/types").DigitalScanAsset | null;
  onDownloadDigitalScan?: () => void;
}) {
  const { userId } = useAuth();
  const isDrawer = layoutMode === "drawer";
  const [excludedKeys, setExcludedKeys] = useState<Set<string>>(new Set());
  const marketIntelTrackedRef = useRef<string | null>(null);

  useEffect(() => {
    setExcludedKeys(new Set());
  }, [selectedSpecimenId]);

  const toggleExclude = useCallback((key: string) => {
    setExcludedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const verified = cards.filter((c) => c.status === "verified").length;
  const review = cards.filter((c) => c.status === "review").length;
  const ambiguous = cards.filter((c) => c.status === "ambiguous").length;
  const rowEnriching = enrichingSpecimenId === selectedSpecimenId;
  const catalogBusy = catalogEnriching || rowEnriching;
  const marketLoading = marketEnriching || rowEnriching;
  const rescanning = Boolean(
    selectedSpecimenId && rescanningId === selectedSpecimenId,
  );
  const canCrop = Boolean(selectedSpecimen?.previewUrl);

  const marketReady = useMemo(
    () => Boolean(selectedSpecimen?.context.marketEvidence?.length),
    [selectedSpecimen],
  );

  useEffect(() => {
    marketIntelTrackedRef.current = null;
  }, [selectedSpecimenId]);

  useEffect(() => {
    if (!userId || !marketReady || !selectedSpecimenId) return;
    const key = `${selectedSpecimenId}:market`;
    if (marketIntelTrackedRef.current === key) return;
    marketIntelTrackedRef.current = key;
    void trackCompanionQuest(userId, "market_intelligence", 1);
  }, [userId, marketReady, selectedSpecimenId]);

  return (
    <aside
      className={cn(
        "flex min-w-0 flex-col",
        isDrawer ? "h-auto min-h-0 bg-transparent" : "h-full sc-glass",
        className,
      )}
    >
      {!isDrawer ? (
        <div className="border-b border-white/6 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-100">Market intelligence</h2>
          <p className="text-[10px] text-slate-500">
            {selectedSpecimen
              ? "Identity collapses when confirmed · expand to edit"
              : "Select a card from the feed"}
          </p>
        </div>
      ) : null}

      <div
        className={cn(
          "min-w-0 space-y-3 overflow-x-hidden p-3 scanner-chat-scrollbar",
          isDrawer ? "" : "flex-1 overflow-y-auto",
        )}
      >
        {summary && !selectedSpecimen ? (
          <div className="sc-glow-border rounded-xl sc-glass-raised p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
              Session
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-50">
              {summary.totalDetected}
              <span className="ml-1 text-sm font-normal text-slate-500">cards</span>
            </p>
            <p className="text-sm text-slate-400">
              ${summary.estimatedTotal.toLocaleString()} session FMV
            </p>
            <div className="mt-2 flex flex-wrap gap-1 text-[10px] text-slate-500">
              <span>{verified} verified</span>
              <span>·</span>
              <span>{review} review</span>
              <span>·</span>
              <span>{ambiguous} uncertain</span>
            </div>
          </div>
        ) : summary && selectedSpecimen ? (
          <p className="truncate rounded-lg border border-white/6 bg-white/[0.03] px-2.5 py-1.5 text-[10px] text-slate-500">
            <span className="font-medium text-slate-400">Session</span> · {summary.totalDetected}{" "}
            cards · ${summary.estimatedTotal.toLocaleString()} FMV
          </p>
        ) : null}
        {!summary ? (
          <p className="text-sm text-slate-600">Run a scan to unlock market intelligence.</p>
        ) : null}

        <CollectorCalculatorCollapsible
          baseAmount={summary?.estimatedTotal ?? 0}
          cardCount={summary?.totalDetected ?? cards.length}
          baseLabel={summary ? "Session FMV" : "Total value"}
        />

        <AnimatePresence mode="wait">
          {selectedSpecimen ? (
            <motion.div
              key={selectedSpecimen.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.22 }}
              className="min-w-0 space-y-3"
            >
              <EvidenceRail
                variant="liquid"
                specimen={selectedSpecimen}
                editable={Boolean(
                  onUpdateSpecimen && onCommitSpecimenEdit && onRescanSpecimen,
                )}
                rowBusy={rescanning || rowEnriching}
                enriching={rowEnriching}
                onUpdate={onUpdateSpecimen}
                onCommitEdit={onCommitSpecimenEdit}
                onRescan={onRescanSpecimen}
                onRequestAdjustCrop={canCrop ? onRequestAdjustCrop : undefined}
                digitalScanAsset={digitalScanAsset}
                onDownloadDigitalScan={onDownloadDigitalScan}
              />
              {!canCrop ? (
                <p className="rounded-lg border border-dashed border-white/10 px-3 py-2 text-[11px] text-slate-500">
                  Upload photos and scan again to adjust crop or resync this row.
                </p>
              ) : null}

              <CatalogMatchPanel
                variant="liquid"
                specimen={selectedSpecimen}
                busy={catalogBusy}
                refreshingCandidates={refreshingCatalogCandidates}
                onConfirmCandidate={onConfirmCandidate}
                onRejectCandidate={onRejectCandidate}
                onRefreshCandidates={onRefreshCatalogCandidates}
                onOpenMasterCatalog={onOpenMasterCatalog}
                panelClassName="rounded-xl border border-amber-500/15 bg-black/20 p-2.5"
              />

              {marketLoading && !marketReady ? (
                <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-[11px] text-emerald-200/90">
                  Loading market comps, listings, and graded sales…
                </p>
              ) : null}

              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                  Market intelligence
                </p>
                <SpecimenMarketHub
                  specimen={selectedSpecimen}
                  enriching={marketLoading}
                  excludedKeys={excludedKeys}
                  onToggleExclude={toggleExclude}
                  compsSectionRef={compsSectionRef}
                  historyRefreshKey={historyRefreshKey ?? 0}
                />
              </div>
            </motion.div>
          ) : (
            <motion.p
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-xl border border-dashed border-white/10 px-3 py-6 text-center text-sm text-slate-600"
            >
              Click a detected card in the feed to see FMV, premium graded comps, live listings,
              and last solds.
            </motion.p>
          )}
        </AnimatePresence>

        {!isDrawer && cards.length > 1 ? (
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">
              Quick select
            </p>
            <div className="max-h-32 space-y-1 overflow-y-auto scanner-chat-scrollbar">
              {cards.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelectSpecimen(c.specimenId)}
                  className={cn(
                    "w-full truncate rounded-lg px-2 py-1.5 text-left text-xs transition",
                    selectedSpecimenId === c.id
                      ? "bg-emerald-500/15 text-emerald-100"
                      : "text-slate-500 hover:bg-white/5 hover:text-slate-300",
                  )}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {!isDrawer ? (
      <div className="shrink-0 space-y-2 border-t border-white/6 p-3">
        {saveStatus ? (
          <p className="text-center text-[10px] text-emerald-300/90">{saveStatus}</p>
        ) : null}
        <button
          type="button"
          onClick={onSaveCollection}
          disabled={!summary || saving}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500/15 py-2 text-xs font-medium text-sky-100 ring-1 ring-sky-500/25 transition hover:bg-sky-500/25 disabled:opacity-40"
        >
          <Bookmark className="h-3.5 w-3.5" />
          {saving ? "Saving…" : loadedSessionId ? "Update saved scan" : "Save scan"}
        </button>
        {review > 0 ? (
          <button
            type="button"
            onClick={onReviewUncertain}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500/10 py-2 text-xs text-amber-200 ring-1 ring-amber-500/20"
          >
            <Search className="h-3.5 w-3.5" />
            Review uncertain ({review})
          </button>
        ) : null}
        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={() => onExport("csv")}
            className="flex flex-col items-center gap-1 rounded-xl border border-white/8 py-2 text-[10px] text-slate-400 hover:text-slate-200"
          >
            <FileText className="h-4 w-4" />
            CSV
          </button>
          <button
            type="button"
            onClick={() => onExport("json")}
            className="flex flex-col items-center gap-1 rounded-xl border border-white/8 py-2 text-[10px] text-slate-400 hover:text-slate-200"
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
                ? "border-white/8 text-slate-400 hover:text-slate-200"
                : "border-amber-500/25 bg-amber-500/5 text-amber-200/90",
            )}
          >
            {isPro ? <FileText className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            PDF
          </button>
        </div>
        {!isPro ? (
          <p className="text-center text-[10px] text-amber-200/80">
            Premium appraisals are on{" "}
            <Link href="/usage" className="underline hover:text-amber-100">
              Pro
            </Link>
            .
          </p>
        ) : null}
        <button
          type="button"
          onClick={onNewScan}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/8 py-2 text-xs text-slate-500 hover:text-slate-300"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          New scan
        </button>
      </div>
      ) : null}
    </aside>
  );
}
