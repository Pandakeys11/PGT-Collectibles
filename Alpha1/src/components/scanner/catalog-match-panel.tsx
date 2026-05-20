"use client";

import Link from "next/link";
import { BookOpen, Check, Search, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { scannerHref } from "@/lib/app-routes";
import { getCardDisplayTitle } from "@/lib/scan/card-display";
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
  onSelect,
  onReject,
}: {
  candidate: CatalogCandidate;
  rank: number;
  active: boolean;
  userSelected: boolean;
  busy?: boolean;
  onSelect: () => void;
  onReject: () => void;
}) {
  const confidencePct = Math.round(candidate.confidence * 100);

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
          <div className="flex h-full items-center justify-center text-[9px] uppercase text-slate-600">No art</div>
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
          {[candidate.setName, candidate.cardNumber, candidate.year, candidate.rarity].filter(Boolean).join(" · ") ||
            "Catalog metadata pending"}
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
  onConfirmCandidate,
  onRejectCandidate,
  panelClassName,
}: {
  specimen: CatalogMatchSpecimen | null;
  busy?: boolean;
  onConfirmCandidate: (candidate: CatalogCandidate) => void;
  onRejectCandidate: (catalogId: string) => void;
  panelClassName?: string;
}) {
  const candidates = specimen?.context.catalogCandidates ?? [];
  const activeCatalogId = specimen?.context.catalogId ?? null;
  const userSelected = specimen?.context.catalogConfidence === 1 && activeCatalogId != null;

  return (
    <section id="catalog" className={panelClassName}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase text-amber-200">Catalog intelligence</p>
          <h2 className="mt-1 text-base font-semibold text-white">Identity match</h2>
        </div>
        <Link
          href={scannerHref("catalog")}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-white/10 bg-white/[0.05] px-3 text-sm font-semibold text-slate-200 transition hover:border-amber-200/35 hover:bg-amber-300/10"
        >
          <BookOpen className="h-4 w-4" />
          Catalog
        </Link>
      </div>

      <div className="mt-3 rounded-lg border border-white/[0.08] bg-[#070b10] p-3">
        <div className="flex items-center gap-2 text-slate-500">
          <Search className="h-4 w-4 shrink-0" />
          <p className="truncate text-sm">
            {specimen
              ? [getCardDisplayTitle(specimen.card), specimen.card.set, specimen.card.number].filter(Boolean).join(" / ")
              : "Select a scanned card to see catalog matches"}
          </p>
        </div>
      </div>

      {specimen ? (
        <div className="mt-3 grid gap-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-2">
              <p className="text-[10px] uppercase text-slate-500">Status</p>
              <p className="mt-1 truncate text-xs font-semibold text-amber-100">{specimen.context.catalogIdentityStatus}</p>
            </div>
            <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-2">
              <p className="text-[10px] uppercase text-slate-500">Best match</p>
              <p className="mt-1 font-mono text-xs text-cyan-100">{pct(specimen.context.catalogConfidence)}</p>
            </div>
            <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-2">
              <p className="text-[10px] uppercase text-slate-500">Options</p>
              <p className="mt-1 font-mono text-xs text-fuchsia-100">{candidates.length}</p>
            </div>
          </div>

          {candidates.length > 0 ? (
            <>
              <p className="text-xs text-slate-400">
                {candidates.length === 1
                  ? "One catalog match found. Select it to confirm or edit fields and resync if wrong."
                  : `${candidates.length} possible matches — compare confidence and select the correct card if the scan picked the wrong identity.`}
              </p>
              <div className="max-h-[min(28rem,52vh)] space-y-2 overflow-y-auto pr-1">
                {candidates.map((candidate, index) => (
                  <CandidateRow
                    key={candidate.catalogId}
                    candidate={candidate}
                    rank={index + 1}
                    active={activeCatalogId === candidate.catalogId}
                    userSelected={userSelected && activeCatalogId === candidate.catalogId}
                    busy={busy}
                    onSelect={() => onConfirmCandidate(candidate)}
                    onReject={() => onRejectCandidate(candidate.catalogId)}
                  />
                ))}
              </div>
            </>
          ) : (
            <p className="rounded-lg border border-dashed border-white/[0.1] px-3 py-5 text-center text-sm text-slate-500">
              {specimen.context.catalogId
                ? "Match is active but alternate options were not loaded. Edit identity fields and resync, or rescan to refresh catalog candidates."
                : "Catalog options appear after scan enrichment. Edit the selected record and resync if the identity needs another pass."}
            </p>
          )}

          {specimen.context.identityEvidence.length > 0 ? (
            <details className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2">
              <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Identity signals ({specimen.context.identityEvidence.length})
              </summary>
              <ul className="mt-2 space-y-1.5 text-[11px] text-slate-500">
                {specimen.context.identityEvidence.slice(0, 8).map((item, index) => (
                  <li key={`${item.field}-${index}`} className="flex gap-2">
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
        <p className="mt-3 rounded-lg border border-dashed border-white/[0.1] px-3 py-5 text-center text-sm text-slate-500">
          Select a scanned card to review all catalog match options and confidence scores.
        </p>
      )}
    </section>
  );
}
