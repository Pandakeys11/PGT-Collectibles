"use client";

import { useEffect, useRef } from "react";
import { Check, Loader2, X } from "lucide-react";
import type { ScanSpecimen } from "@/hooks/use-scan-session";
import type { CatalogCandidate } from "@/lib/scan/schemas";
import { MIN_CATALOG_PICK_OPTIONS } from "@/lib/market/ensure-catalog-options";
import {
  catalogQuickPickRank,
  catalogQuickPickVisible,
  getActiveCatalogCandidate,
} from "@/lib/scanner-chat/catalog-match-present";
import { cn } from "@/lib/cn";

export function CatalogMatchQuickPick({
  specimen,
  busy = false,
  refreshing = false,
  onConfirm,
  onReject,
  onRefreshCandidates,
  onOpenMasterCatalog,
  className,
}: {
  specimen: ScanSpecimen | null;
  busy?: boolean;
  refreshing?: boolean;
  onConfirm: (specimenId: string, candidate: CatalogCandidate) => void;
  onReject: (specimenId: string, catalogId: string) => void;
  onRefreshCandidates?: (specimenId: string) => void;
  onOpenMasterCatalog?: () => void;
  className?: string;
}) {
  const autoRefreshKeyRef = useRef<string | null>(null);

  const visible = specimen ? catalogQuickPickVisible(specimen) : false;
  const candidate = specimen ? getActiveCatalogCandidate(specimen.context) : null;
  const catalogBusy = busy || refreshing;
  const totalOptions = specimen?.context.catalogCandidates.length ?? 0;
  const rank = candidate && specimen ? catalogQuickPickRank(specimen.context, candidate) : 0;

  useEffect(() => {
    if (!specimen || !onRefreshCandidates || catalogBusy || !visible) return;
    const { context, card } = specimen;
    const key = [
      context.specimenId,
      card.name,
      card.set,
      card.number,
      context.catalogIdentityStatus,
      String(totalOptions),
    ].join("|");
    if (autoRefreshKeyRef.current === key) return;
    const shouldAuto =
      totalOptions < MIN_CATALOG_PICK_OPTIONS &&
      (context.catalogIdentityStatus === "failed" ||
        context.catalogIdentityStatus === "ambiguous" ||
        context.catalogIdentityStatus === "likely");
    if (!shouldAuto) return;
    autoRefreshKeyRef.current = key;
    const timer = window.setTimeout(() => onRefreshCandidates(specimen.id), 700);
    return () => window.clearTimeout(timer);
  }, [specimen, onRefreshCandidates, catalogBusy, visible, totalOptions]);

  if (!specimen || !visible) return null;

  const confidencePct = Math.round((candidate?.confidence ?? specimen.context.catalogConfidence ?? 0) * 100);

  return (
    <div
      className={cn(
        "rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-2.5 py-2",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-amber-200/90">
          Catalog match
        </p>
        {totalOptions > 0 ? (
          <p className="font-mono text-[9px] tabular-nums text-slate-500">
            {rank}/{totalOptions}
          </p>
        ) : null}
      </div>

      {refreshing && !candidate ? (
        <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden />
          Searching master catalog…
        </div>
      ) : candidate ? (
        <div className="mt-2 grid grid-cols-[auto_1fr_auto] items-center gap-2">
          <div className="h-14 w-10 shrink-0 overflow-hidden rounded-md border border-white/10 bg-black/40">
            {candidate.imageSmallUrl || candidate.imageLargeUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={candidate.imageSmallUrl ?? candidate.imageLargeUrl ?? ""}
                alt=""
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-[8px] text-slate-600">
                —
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[12px] font-semibold text-slate-100">{candidate.name}</p>
            <p className="truncate text-[10px] text-slate-500">
              {[candidate.setName, candidate.cardNumber, candidate.year]
                .filter(Boolean)
                .join(" · ") || "—"}
            </p>
            <p className="mt-0.5 font-mono text-[9px] tabular-nums text-slate-500">
              {confidencePct}% match
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-1">
            <button
              type="button"
              disabled={catalogBusy}
              onClick={() => onConfirm(specimen.id, candidate)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/35 bg-emerald-500/15 text-emerald-200 transition hover:bg-emerald-500/25 disabled:opacity-40 touch-manipulation"
              aria-label="Confirm catalog match"
              title="Confirm match"
            >
              <Check className="h-4 w-4" strokeWidth={2.5} />
            </button>
            <button
              type="button"
              disabled={catalogBusy || totalOptions <= 1}
              onClick={() => onReject(specimen.id, candidate.catalogId)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-40 touch-manipulation"
              aria-label="Reject and show next match"
              title={totalOptions > 1 ? "Not this card — next option" : "No more options"}
            >
              <X className="h-4 w-4" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          <p className="text-[11px] leading-snug text-slate-400">
            No close catalog matches yet. Browse the master catalog or edit name / set / number,
            then refresh.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {onRefreshCandidates ? (
              <button
                type="button"
                disabled={catalogBusy}
                onClick={() => onRefreshCandidates(specimen.id)}
                className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-medium text-slate-300 transition hover:border-cyan-500/30 hover:text-cyan-100 disabled:opacity-40 touch-manipulation"
              >
                Search again
              </button>
            ) : null}
            {onOpenMasterCatalog ? (
              <button
                type="button"
                onClick={onOpenMasterCatalog}
                className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-[10px] font-medium text-amber-100 transition hover:bg-amber-500/15 touch-manipulation"
              >
                Browse catalog
              </button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
