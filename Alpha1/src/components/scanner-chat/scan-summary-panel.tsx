"use client";

import { motion } from "framer-motion";
import { FileSpreadsheet, FileText, RefreshCw, Search } from "lucide-react";
import type { CardMatch, ScanSummary } from "@/lib/scanner-chat/types";
import { cn } from "@/lib/cn";

export function ScanSummaryInline({
  summary,
  compact,
}: {
  summary: ScanSummary;
  compact?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "sc-glow-border rounded-xl sc-glass",
        compact ? "p-2.5 sm:p-3" : "rounded-2xl p-4",
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400 sm:text-xs">
        Scan complete
      </p>
      <ul
        className={cn(
          "mt-1.5 space-y-0.5 text-slate-300",
          compact ? "text-[11px] sm:text-xs" : "mt-2 space-y-1 text-sm",
        )}
      >
        <li>{summary.totalDetected} cards detected</li>
        <li>{summary.highConfidence} high-confidence matches</li>
        <li>{summary.needsReview} need review</li>
        <li>
          Estimated session FMV: ${summary.estimatedTotal.toLocaleString()}
        </li>
        {summary.bestHit ? (
          <li className="text-slate-100">
            Best hit: {summary.bestHit.name} — ${summary.bestHit.fmv.toLocaleString()} FMV
          </li>
        ) : null}
      </ul>
      <p className={cn("text-emerald-400/80", compact ? "mt-1.5 text-[10px]" : "mt-2 text-xs")}>
        Export ready · open Sheet tab for Excel-style list · Deal calculator in sidebar
      </p>
    </motion.div>
  );
}

function ConfidenceBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-[10px] text-slate-500">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function ScanSummaryPanel({
  summary,
  cards,
  onReviewUncertain,
  onExport,
  onNewScan,
  className,
}: {
  summary: ScanSummary | null;
  cards: CardMatch[];
  onReviewUncertain: () => void;
  onExport: (format: string) => void;
  onNewScan: () => void;
  className?: string;
}) {
  const verified = cards.filter((c) => c.status === "verified").length;
  const review = cards.filter((c) => c.status === "review").length;
  const ambiguous = cards.filter((c) => c.status === "ambiguous").length;

  return (
    <aside className={cn("flex h-full flex-col sc-glass", className)}>
      <div className="border-b border-white/6 p-4">
        <h2 className="text-sm font-semibold text-slate-100">Scan intelligence</h2>
        <p className="text-[10px] text-slate-500">Live summary & export</p>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4 scanner-chat-scrollbar">
        {summary ? (
          <>
            <div className="sc-glow-border rounded-2xl sc-glass-raised p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                Current scan
              </p>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-50">
                {summary.totalDetected}
                <span className="ml-1 text-sm font-normal text-slate-500">cards</span>
              </p>
              <p className="mt-1 text-lg text-slate-300">
                ${summary.estimatedTotal.toLocaleString()}
                <span className="text-xs text-slate-600"> session FMV</span>
              </p>
            </div>
            <div className="space-y-3">
              <ConfidenceBar label="Verified" value={verified} total={cards.length} color="bg-emerald-500" />
              <ConfidenceBar label="Needs review" value={review} total={cards.length} color="bg-amber-500" />
              <ConfidenceBar label="Uncertain" value={ambiguous} total={cards.length} color="bg-rose-500" />
            </div>
            {summary.bestHit ? (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                <p className="text-[10px] uppercase tracking-wider text-amber-400/80">Best hit</p>
                <p className="font-medium text-slate-100">{summary.bestHit.name}</p>
                <p className="text-sm text-slate-400">
                  ${summary.bestHit.fmv.toLocaleString()} FMV
                </p>
              </div>
            ) : null}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={onReviewUncertain}
                className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500/15 py-2.5 text-sm font-medium text-emerald-100 ring-1 ring-emerald-500/25 transition hover:bg-emerald-500/25"
              >
                <Search className="h-4 w-4" />
                Review uncertain matches
              </button>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { fmt: "csv", icon: FileText, label: "CSV" },
                  { fmt: "json", icon: FileSpreadsheet, label: "JSON" },
                ].map((e) => {
                  const Icon = e.icon;
                  return (
                    <button
                      key={e.fmt}
                      type="button"
                      onClick={() => onExport(e.fmt)}
                      className="flex flex-col items-center gap-1 rounded-xl border border-white/8 py-2 text-[10px] text-slate-400 transition hover:bg-white/5 hover:text-slate-200"
                    >
                      <Icon className="h-4 w-4" />
                      {e.label}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={onNewScan}
                className="flex items-center justify-center gap-2 rounded-xl border border-white/8 py-2 text-xs text-slate-500 transition hover:text-slate-300"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Scan another page
              </button>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-600">
            Run a scan to see detected cards, confidence breakdown, and export options.
          </p>
        )}
      </div>
    </aside>
  );
}
