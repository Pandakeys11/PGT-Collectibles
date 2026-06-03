"use client";

import { motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import type { SystemChatMessage } from "@/lib/scanner-chat/types";
import type {
  ScanEvolutionStage,
  ScanPipelineAccent,
  ScanPipelineSprite,
} from "@/lib/scanner-chat/scan-pipeline-evolution";
import { ScanPipelineHoloText } from "@/components/scanner-chat/scan-pipeline-holo-text";
import { ScanPipelineSpriteCell } from "@/components/scanner-chat/scan-pipeline-sprite-cell";
import { cn } from "@/lib/cn";

function accentHeaderClass(accent: ScanPipelineAccent): string {
  switch (accent) {
    case "fire":
      return "from-orange-600/90 via-orange-500/40 to-amber-900/80";
    case "grass":
      return "from-emerald-600/90 via-emerald-500/40 to-emerald-950/80";
    case "water":
      return "from-sky-600/90 via-sky-500/40 to-sky-950/80";
    case "rare":
      return "from-amber-500/90 via-yellow-400/35 to-violet-900/70";
  }
}

function stageBadge(stage: 0 | 1 | 2): string {
  if (stage === 0) return "BASIC";
  if (stage === 1) return "STAGE 1";
  return "STAGE 2";
}

export function ScanPipelineTcgFrame({
  progress,
  accent,
  lineLabel,
  rare,
  sprite,
  phaseLabel,
  stepLabel,
  evolving,
  transformLegendary,
  evolutionStage,
  steps,
  children,
  className,
}: {
  progress: number;
  accent: ScanPipelineAccent;
  lineLabel: string;
  rare?: boolean;
  sprite: ScanPipelineSprite;
  phaseLabel: string;
  stepLabel?: string | null;
  evolving?: boolean;
  transformLegendary?: boolean;
  evolutionStage: ScanEvolutionStage;
  steps: SystemChatMessage[];
  /** Optional slot above pipeline list (unused if steps inline). */
  children?: React.ReactNode;
  className?: string;
}) {
  const stage = evolutionStage;
  const pct = Math.round(progress * 100);

  return (
    <article
      className={cn(
        "sc-scan-tcg-card sc-glow-border mx-auto w-full max-w-[17.5rem]",
        className,
      )}
      aria-label="Scan pipeline"
    >
      <div className="sc-scan-tcg-card__inner overflow-hidden rounded-[0.65rem]">
        {/* Header bar */}
        <header
          className={cn(
            "sc-scan-tcg-card__header flex items-center justify-between gap-2 bg-gradient-to-r px-2.5 py-1.5",
            accentHeaderClass(accent),
          )}
        >
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="sc-scan-tcg-card__pip shrink-0" aria-hidden />
            <span className="truncate text-[9px] font-black uppercase tracking-[0.12em] text-white/95">
              PGT Evolution Scan
            </span>
          </div>
          <span className="shrink-0 rounded bg-black/35 px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums text-white/90">
            {pct}%
          </span>
        </header>

        <div
          className="sc-scan-tcg-progress mx-2 mt-1.5 h-0.5 overflow-hidden rounded-full bg-black/50"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="sc-scan-tcg-progress__fill h-full rounded-full transition-[width] duration-700 ease-out"
            style={{ width: `${Math.max(5, pct)}%` }}
          />
        </div>

        {/* Art window */}
        <div className="sc-scan-tcg-card__art relative mx-2 mt-2 overflow-hidden rounded-md border-2 border-black/50 bg-gradient-to-b from-slate-800/80 to-black">
          <span className="sc-scan-tcg-art-foil pointer-events-none" aria-hidden />
          <div className="relative z-[1] flex min-h-[8.5rem] items-end justify-center px-2 pb-2 pt-3 sm:min-h-[9.25rem]">
            <ScanPipelineSpriteCell
              sprite={sprite}
              lineAccent={accent}
              evolving={evolving}
              rare={rare}
              transformLegendary={transformLegendary}
              variant="art"
            />
          </div>
          {rare ? (
            <span className="absolute right-1.5 top-1.5 z-[2] rounded bg-amber-400/90 px-1 py-px text-[7px] font-black uppercase text-black">
              ★
            </span>
          ) : null}
        </div>

        {/* Name plate */}
        <div className="mx-2 mt-2 flex items-end justify-between gap-2 border-b border-black/40 pb-1.5">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold uppercase tracking-tight text-slate-50">
              {sprite.name}
            </h3>
            <p className="text-[9px] font-medium uppercase tracking-wider text-slate-500">
              {lineLabel}
            </p>
          </div>
          <span className="shrink-0 rounded border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-black text-amber-200">
            {stageBadge(stage as 0 | 1 | 2)}
          </span>
        </div>

        {/* Ability / status — holo text */}
        <div className="sc-scan-tcg-card__text mx-2 mt-2 min-h-[2.75rem] rounded-md border border-white/8 bg-black/40 px-2 py-2">
          <p className="mb-1 text-[8px] font-bold uppercase tracking-[0.14em] text-slate-500">
            Scan ability
          </p>
          <ScanPipelineHoloText
            as="p"
            className="text-[11px] font-semibold leading-snug"
            fast
          >
            {phaseLabel}
          </ScanPipelineHoloText>
          {stepLabel ? (
            <p className="mt-2 border-t border-white/6 pt-2 text-[10px] leading-snug text-slate-400">
              {stepLabel}
            </p>
          ) : null}
        </div>

        {/* Pipeline steps — card footer */}
        {steps.length > 0 ? (
          <footer className="sc-scan-tcg-card__footer mx-2 mb-2 mt-2 rounded-md border border-black/50 bg-slate-950/90 px-2 py-2">
            <p className="mb-1.5 text-[8px] font-bold uppercase tracking-[0.14em] text-slate-500">
              Scan pipeline
            </p>
            <ul className="space-y-1">
              {steps.map((step, i) => (
                <motion.li
                  key={step.id}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.025, duration: 0.2 }}
                  className="flex items-center gap-2"
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                      step.active
                        ? "border-emerald-400/50 bg-emerald-500/20"
                        : step.done
                          ? "border-emerald-500/35 bg-emerald-500/15"
                          : "border-white/10 bg-white/5",
                    )}
                  >
                    {step.active ? (
                      <Loader2 className="h-2.5 w-2.5 animate-spin text-emerald-400" />
                    ) : step.done ? (
                      <Check className="h-2.5 w-2.5 text-emerald-400" />
                    ) : (
                      <span className="h-1 w-1 rounded-full bg-slate-600" />
                    )}
                  </span>
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-[10px] leading-tight",
                      !step.active && (step.done ? "text-slate-400" : "text-slate-600"),
                    )}
                  >
                    {step.active ? (
                      <ScanPipelineHoloText as="span" className="block truncate text-[10px] font-medium">
                        {step.label}
                      </ScanPipelineHoloText>
                    ) : (
                      step.label
                    )}
                  </span>
                </motion.li>
              ))}
            </ul>
          </footer>
        ) : null}

        {children}
      </div>
    </article>
  );
}
