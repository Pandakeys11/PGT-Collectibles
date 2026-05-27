"use client";

import { useEffect, useRef } from "react";
import { BookOpen, Check, RefreshCw, Search, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { getCardDisplayTitle } from "@/lib/scan/card-display";
import { MIN_CATALOG_PICK_OPTIONS } from "@/lib/market/ensure-catalog-options";
import type { CatalogCandidate, ExtractedCard, ScanCardContext } from "@/lib/scan/schemas";

type CatalogMatchSpecimen = {
  card: ExtractedCard;
  context: ScanCardContext;
};

function pct(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${Math.round(value * 100)}%`;
}

function confidenceTone(confidence: number) {
  if (confidence >= 0.85) return "bg-emerald-400";
  if (confidence >= 0.65) return "bg-amber-400";
  return "bg-rose-400";
}

function CandidateRow({
  candidate,
  rank,
  active,
  userSelected,
  busy,
  compact,
  onSelect,
  onReject,
}: {
  candidate: CatalogCandidate;
  rank: number;
  active: boolean;
  userSelected: boolean;
  busy?: boolean;
  compact?: boolean;
  onSelect: () => void;
  onReject: () => void;
}) {
  const confidencePct = Math.round(candidate.confidence * 100);

  if (compact) {
    return (
      <div
        className={cn(
          "grid grid-cols-[auto_1fr_auto] items-start gap-2 rounded-lg border px-2 py-1.5",
          active
            ? "border-emerald-500/30 bg-emerald-500/10 ring-1 ring-emerald-500/20"
            : "border-white/8 bg-white/[0.02] hover:border-amber-500/20",
        )}
      >
        <span className="mt-0.5 font-mono text-[9px] text-slate-500">#{rank}</span>
        <div className="flex min-w-0 gap-2">
          <div className="h-12 w-8 shrink-0 overflow-hidden rounded border border-white/10 bg-black/40">
            {candidate.imageSmallUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={candidate.imageSmallUrl} alt="" className="h-full w-full object-contain" />
            ) : (
              <div className="flex h-full items-center justify-center text-[8px] text-slate-600">—</div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold text-slate-100">{candidate.name}</p>
            <p className="truncate text-[9px] text-slate-500">
              {[candidate.setName, candidate.cardNumber, candidate.year].filter(Boolean).join(" · ") ||
                "—"}
            </p>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-black/40">
              <div
                className={cn("h-full rounded-full", confidenceTone(candidate.confidence))}
                style={{ width: `${Math.max(4, confidencePct)}%` }}
              />
            </div>
            <p className="mt-0.5 font-mono text-[9px] text-slate-500">{confidencePct}%</p>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <button
            type="button"
            disabled={busy || active}
            onClick={onSelect}
            className="inline-flex h-7 items-center justify-center gap-0.5 rounded-md border border-emerald-500/30 bg-emerald-500/12 px-2 text-[9px] font-semibold text-emerald-100 disabled:opacity-40 touch-manipulation"
          >
            <Check className="h-3 w-3" />
            Pick
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onReject}
            className="inline-flex h-7 w-full items-center justify-center rounded-md border border-rose-500/20 bg-rose-500/8 text-rose-200/90 disabled:opacity-40 touch-manipulation"
            aria-label="Dismiss candidate"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid gap-3 rounded-lg border p-3 sm:grid-cols-[auto_2.5rem_minmax(0,1fr)_auto]",
        active
          ? "border-emerald-300/30 bg-emerald-300/[0.08] ring-1 ring-emerald-300/20"
          : "border-white/[0.08] bg-white/[0.025] hover:border-amber-200/25 hover:bg-amber-300/[0.04]",
      )}
    >
      <div className="flex items-start sm:flex-col sm:items-center sm:justify-center sm:pt-1">
        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-white/10 bg-black/30 px-1.5 font-mono text-[10px] font-semibold text-slate-300">
          #{rank}
        </span>
      </div>

      <div className="h-16 w-11 overflow-hidden rounded border border-white/10 bg-[#070b10] sm:h-14 sm:w-10">
        {candidate.imageSmallUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={candidate.imageSmallUrl} alt="" className="h-full w-full object-contain" />
        ) : (
          <div className="flex h-full items-center justify-center text-[9px] uppercase text-slate-600">
            No art
          </div>
        )}
      </div>

      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-slate-100">{candidate.name}</p>
          {active ? (
            <span
              className={cn(
                "rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                userSelected
                  ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-200"
                  : "border-cyan-300/25 bg-cyan-300/10 text-cyan-200",
              )}
            >
              {userSelected ? "Your selection" : "Current match"}
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {[candidate.setName, candidate.cardNumber, candidate.year, candidate.rarity]
            .filter(Boolean)
            .join(" · ") || "Catalog metadata pending"}
        </p>
        {candidate.conflicts.length > 0 ? (
          <p className="mt-1 text-[10px] text-rose-200/85">{candidate.conflicts.join(" · ")}</p>
        ) : candidate.reasons.length > 0 ? (
          <p className="mt-1 text-[10px] text-slate-500">{candidate.reasons.slice(0, 3).join(" · ")}</p>
        ) : null}
        <div className="mt-2">
          <div className="mb-1 flex items-center justify-between gap-2 text-[10px] uppercase tracking-wide text-slate-500">
            <span>Match confidence</span>
            <span className="font-mono text-slate-300">{confidencePct}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-black/40">
            <div
              className={cn("h-full rounded-full transition-all", confidenceTone(candidate.confidence))}
              style={{ width: `${Math.max(4, confidencePct)}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-row items-center gap-2 sm:flex-col sm:justify-center">
        <button
          type="button"
          disabled={busy || active}
          onClick={onSelect}
          className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-md border border-emerald-300/25 bg-emerald-300/10 px-2.5 text-[11px] font-semibold text-emerald-100 transition hover:bg-emerald-300/15 disabled:pointer-events-none disabled:opacity-45 sm:w-full sm:flex-none"
        >
          <Check className="h-3.5 w-3.5" />
          Select
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onReject}
          title="Remove this option from the list"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-rose-300/20 bg-rose-300/8 text-rose-100 transition hover:bg-rose-300/12 disabled:pointer-events-none disabled:opacity-45"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function CatalogMatchPanel({
  specimen,
  busy = false,
  refreshingCandidates = false,
  onConfirmCandidate,
  onRejectCandidate,
  onRefreshCandidates,
  onOpenMasterCatalog,
  panelClassName,
  variant = "default",
}: {
  specimen: CatalogMatchSpecimen | null;
  busy?: boolean;
  refreshingCandidates?: boolean;
  onConfirmCandidate: (candidate: CatalogCandidate) => void;
  onRejectCandidate: (catalogId: string) => void;
  /** Deep search against master catalog / Pokédex API for more pick options. */
  onRefreshCandidates?: () => void;
  onOpenMasterCatalog?: () => void;
  panelClassName?: string;
  variant?: "default" | "liquid";
}) {
  const compact = variant === "liquid";
  const candidates = specimen?.context.catalogCandidates ?? [];
  const activeCatalogId = specimen?.context.catalogId ?? null;
  const userSelected = specimen?.context.catalogConfidence === 1 && activeCatalogId != null;
  const catalogBusy = busy || refreshingCandidates;
  const autoRefreshKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!specimen || !onRefreshCandidates || catalogBusy || userSelected) return;
    const key = [
      specimen.context.specimenId,
      specimen.card.name,
      specimen.card.set,
      specimen.card.number,
      specimen.context.catalogIdentityStatus,
      String(candidates.length),
    ].join("|");
    if (autoRefreshKeyRef.current === key) return;
    const shouldAuto =
      candidates.length < MIN_CATALOG_PICK_OPTIONS &&
      (specimen.context.catalogIdentityStatus === "failed" ||
        specimen.context.catalogIdentityStatus === "ambiguous" ||
        specimen.context.catalogIdentityStatus === "likely");
    if (!shouldAuto) return;
    autoRefreshKeyRef.current = key;
    const timer = window.setTimeout(() => onRefreshCandidates(), 700);
    return () => window.clearTimeout(timer);
  }, [
    specimen,
    onRefreshCandidates,
    catalogBusy,
    userSelected,
    candidates.length,
  ]);

  return (
    <section id="catalog" className={panelClassName}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p
            className={cn(
              "font-semibold uppercase tracking-wider text-amber-400/90",
              compact ? "text-[9px]" : "text-[10px] text-amber-200",
            )}
          >
            Catalog match
          </p>
          {!compact ? (
            <h2 className="mt-1 text-base font-semibold text-white">Identity match</h2>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {onRefreshCandidates ? (
            <button
              type="button"
              disabled={catalogBusy || !specimen}
              onClick={onRefreshCandidates}
              title="Search master catalog for closest matches"
              className={cn(
                "inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] font-semibold text-slate-200 transition hover:border-cyan-500/30 hover:bg-cyan-500/10 disabled:opacity-40 touch-manipulation",
                compact ? "h-7 px-2 text-[10px]" : "h-9 px-2.5 text-sm",
              )}
            >
              <RefreshCw
                className={cn(
                  compact ? "h-3 w-3" : "h-4 w-4",
                  refreshingCandidates && "animate-spin",
                )}
              />
              {compact ? null : "More"}
            </button>
          ) : null}
          {onOpenMasterCatalog ? (
            <button
              type="button"
              onClick={onOpenMasterCatalog}
              className={cn(
                "inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] font-semibold text-slate-200 transition hover:border-amber-500/30 hover:bg-amber-500/10 touch-manipulation",
                compact ? "h-7 px-2 text-[10px]" : "h-9 px-3 text-sm",
              )}
            >
              <BookOpen className={cn(compact ? "h-3 w-3" : "h-4 w-4")} />
              Browse
            </button>
          ) : null}
        </div>
      </div>

      <div
        className={cn(
          "mt-2 rounded-lg border border-white/8 bg-black/25",
          compact ? "px-2 py-1.5" : "p-3",
        )}
      >
        <div className="flex items-center gap-1.5 text-slate-500">
          <Search className={cn("shrink-0", compact ? "h-3 w-3" : "h-4 w-4")} />
          <p className={cn("truncate", compact ? "text-[10px] text-slate-400" : "text-sm")}>
            {specimen
              ? [getCardDisplayTitle(specimen.card), specimen.card.set, specimen.card.number]
                  .filter(Boolean)
                  .join(" / ")
              : "Select a scanned card to see catalog matches"}
          </p>
        </div>
      </div>

      {specimen ? (
        <div className={cn(compact ? "mt-2 space-y-2" : "mt-3 grid gap-3")}>
          <div
            className={cn(
              "grid gap-1.5",
              compact ? "grid-cols-3" : "grid-cols-3 gap-2",
            )}
          >
            {(
              [
                ["Status", specimen.context.catalogIdentityStatus],
                ["Best", pct(specimen.context.catalogConfidence)],
                ["Opts", String(candidates.length)],
              ] as const
            ).map(([label, value]) => (
              <div
                key={label}
                className="rounded-md border border-white/8 bg-white/[0.03] px-1.5 py-1"
              >
                <p className="text-[8px] font-semibold uppercase tracking-wider text-slate-500">
                  {label}
                </p>
                <p className="mt-0.5 truncate font-mono text-[10px] font-semibold text-slate-200">
                  {value}
                </p>
              </div>
            ))}
          </div>

          {candidates.length > 0 ? (
            <>
              <p className={cn("text-slate-400", compact ? "text-[10px] leading-snug" : "text-xs")}>
                {candidates.length === 1
                  ? "One close match from master catalog — confirm or tap More for alternates."
                  : `${candidates.length} closest options from master catalog — pick the correct card.`}
              </p>
              <div
                className={cn(
                  "space-y-1.5 overflow-y-auto pr-0.5 scanner-chat-scrollbar",
                  compact ? "max-h-[min(28dvh,240px)]" : "max-h-[min(28rem,52vh)]",
                )}
              >
                {candidates.map((candidate, index) => (
                  <CandidateRow
                    key={candidate.catalogId}
                    candidate={candidate}
                    rank={index + 1}
                    active={activeCatalogId === candidate.catalogId}
                    userSelected={userSelected && activeCatalogId === candidate.catalogId}
                    busy={catalogBusy}
                    compact={compact}
                    onSelect={() => onConfirmCandidate(candidate)}
                    onReject={() => onRejectCandidate(candidate.catalogId)}
                  />
                ))}
              </div>
            </>
          ) : (
            <p
              className={cn(
                "rounded-lg border border-dashed border-white/10 text-center text-slate-500",
                compact ? "px-2 py-3 text-[10px]" : "px-3 py-5 text-sm",
              )}
            >
              {refreshingCandidates
                ? "Searching master catalog…"
                : specimen.context.catalogId
                  ? "Match active — tap More to load alternate catalog rows."
                  : "No close matches yet — edit name/set/number or tap More to search Pokédex."}
            </p>
          )}

          {specimen.context.identityEvidence.length > 0 ? (
            <details className="rounded-lg border border-white/8 bg-white/[0.02] px-2 py-1.5">
              <summary
                className={cn(
                  "cursor-pointer font-semibold uppercase tracking-wide text-slate-400 touch-manipulation",
                  compact ? "text-[9px]" : "text-[11px]",
                )}
              >
                Signals ({specimen.context.identityEvidence.length})
              </summary>
              <ul className="mt-1.5 space-y-1 text-[10px] text-slate-500">
                {specimen.context.identityEvidence.slice(0, 6).map((item, index) => (
                  <li key={`${item.field}-${index}`} className="flex gap-1.5">
                    <span
                      className={cn(
                        "shrink-0 uppercase",
                        item.status === "match"
                          ? "text-emerald-300/90"
                          : item.status === "conflict"
                            ? "text-rose-300/90"
                            : "text-slate-500",
                      )}
                    >
                      {item.status}
                    </span>
                    <span className="min-w-0 truncate">{item.reason}</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : (
        <p
          className={cn(
            "mt-2 rounded-lg border border-dashed border-white/10 text-center text-slate-500",
            compact ? "px-2 py-3 text-[10px]" : "mt-3 px-3 py-5 text-sm",
          )}
        >
          Select a scanned card to review catalog matches.
        </p>
      )}
    </section>
  );
}
