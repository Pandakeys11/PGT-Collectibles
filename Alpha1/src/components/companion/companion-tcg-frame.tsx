"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { ScanPipelineHoloText } from "@/components/scanner-chat/scan-pipeline-holo-text";
import { cn } from "@/lib/cn";

export function companionStageBadge(level: number, tier?: string | null): string {
  if (tier === "legendary") return "★ RARE";
  if (level >= 20) return "STAGE 2";
  if (level >= 10) return "STAGE 1";
  return "BASIC";
}

export function CompanionTcgFrame({
  xpPercent,
  name,
  lineLabel,
  stageBadge,
  abilityTitle = "Partner ability",
  abilityText,
  statusHint,
  rare,
  onDismiss,
  art,
  footer,
  className,
}: {
  xpPercent: number;
  name: string;
  lineLabel: string;
  stageBadge: string;
  abilityTitle?: string;
  abilityText: string;
  statusHint?: string | null;
  rare?: boolean;
  onDismiss?: () => void;
  art: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(xpPercent)));

  return (
    <article
      className={cn(
        "sc-scan-tcg-card sc-companion-tcg-card sc-glow-border mx-auto w-full max-w-[20rem]",
        className,
      )}
      aria-label="PGT Partner card"
    >
      <div className="sc-scan-tcg-card__inner overflow-hidden rounded-[0.65rem]">
        <header className="sc-scan-tcg-card__header sc-companion-tcg-card__header flex items-center justify-between gap-2 bg-gradient-to-r from-violet-600/90 via-fuchsia-500/40 to-violet-950/80 px-2.5 py-1.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="sc-scan-tcg-card__pip shrink-0" aria-hidden />
            <span className="truncate text-[9px] font-black uppercase tracking-[0.12em] text-white/95">
              PGT Partner Card
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <span className="rounded bg-black/35 px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums text-white/90">
              {pct}% XP
            </span>
            {onDismiss ? (
              <button
                type="button"
                onClick={onDismiss}
                className="flex h-6 w-6 items-center justify-center rounded-md text-white/70 transition hover:bg-black/30 hover:text-white"
                aria-label="Close companion"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </header>

        <div
          className="sc-scan-tcg-progress mx-2 mt-1.5 h-0.5 overflow-hidden rounded-full bg-black/50"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Partner experience"
        >
          <div
            className="sc-scan-tcg-progress__fill h-full rounded-full transition-[width] duration-700 ease-out"
            style={{ width: `${Math.max(4, pct)}%` }}
          />
        </div>

        <div className="sc-scan-tcg-card__art sc-companion-tcg-card__art relative mx-2 mt-2 overflow-hidden rounded-md border-2 border-black/50 bg-gradient-to-b from-violet-950/50 via-slate-900/80 to-black">
          <span className="sc-scan-tcg-art-foil pointer-events-none" aria-hidden />
          <div className="relative z-[1] flex min-h-[9rem] flex-col items-center justify-center px-2 py-3 sm:min-h-[9.5rem]">
            {art}
          </div>
          {rare ? (
            <span className="absolute right-1.5 top-1.5 z-[2] rounded bg-amber-400/90 px-1 py-px text-[7px] font-black uppercase text-black">
              ★
            </span>
          ) : null}
        </div>

        <div className="mx-2 mt-2 flex items-end justify-between gap-2 border-b border-black/40 pb-1.5">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold uppercase tracking-tight text-slate-50">{name}</h3>
            <p className="text-[9px] font-medium uppercase tracking-wider text-slate-500">{lineLabel}</p>
          </div>
          <span className="shrink-0 rounded border border-fuchsia-400/40 bg-fuchsia-500/15 px-1.5 py-0.5 text-[9px] font-black text-fuchsia-100">
            {stageBadge}
          </span>
        </div>

        <div className="sc-scan-tcg-card__text mx-2 mt-2 min-h-[2.5rem] rounded-md border border-white/8 bg-black/40 px-2 py-2">
          <p className="mb-1 text-[8px] font-bold uppercase tracking-[0.14em] text-slate-500">
            {abilityTitle}
          </p>
          <ScanPipelineHoloText as="p" className="text-[11px] font-semibold leading-snug" fast>
            {abilityText}
          </ScanPipelineHoloText>
          {statusHint ? (
            <p className="mt-2 border-t border-white/6 pt-2 text-[10px] leading-snug text-slate-400">
              {statusHint}
            </p>
          ) : null}
        </div>

        {footer ? (
          <footer className="sc-scan-tcg-card__footer sc-companion-tcg-card__footer mx-2 mb-2 mt-2 rounded-md border border-black/50 bg-slate-950/90 px-2 py-2">
            {footer}
          </footer>
        ) : null}
      </div>
    </article>
  );
}
