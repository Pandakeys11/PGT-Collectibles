"use client";

import { DollarSign } from "lucide-react";
import {
  resolveGraderBadge,
  resolveGraderBadgeFromCardMatch,
  type GraderBadgeStyle,
} from "@/lib/scan/grader-badge-styles";
import { cn } from "@/lib/cn";

const GEM_CLIP =
  "polygon(50% 0%, 92% 18%, 100% 50%, 78% 88%, 50% 100%, 22% 88%, 0% 50%, 8% 18%)";

export function GradedSlabBadge({
  grader,
  grade,
  labelTitle,
  slab,
  variant = "chip",
  className,
  fmvFallback,
}: {
  grader?: string | null;
  grade?: string | null;
  labelTitle?: string | null;
  slab?: string | null;
  variant?: "chip" | "gem" | "compact";
  className?: string;
  /** Shown inside gem when ungraded — e.g. FMV number without $. */
  fmvFallback?: string | null;
}) {
  const style = resolveGraderBadge({ grader, grade, labelTitle, slab });

  if (variant === "gem") {
    return <GradeGemBadge style={style} fmvFallback={fmvFallback} className={className} />;
  }
  if (variant === "compact") {
    return <GradeCompactBadge style={style} className={className} />;
  }
  return <GradeChipBadge style={style} className={className} />;
}

export function GradedSlabBadgeFromCard({
  card,
  variant = "chip",
  className,
  fmvFallback,
}: {
  card: Parameters<typeof resolveGraderBadgeFromCardMatch>[0];
  variant?: "chip" | "gem" | "compact";
  className?: string;
  fmvFallback?: string | null;
}) {
  const style = resolveGraderBadgeFromCardMatch(card);
  if (variant === "gem") {
    return <GradeGemBadge style={style} fmvFallback={fmvFallback} className={className} />;
  }
  if (variant === "compact") {
    return <GradeCompactBadge style={style} className={className} />;
  }
  return <GradeChipBadge style={style} className={className} />;
}

function GradeChipBadge({
  style,
  className,
}: {
  style: GraderBadgeStyle;
  className?: string;
}) {
  if (style.tier === "raw") return null;

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide ring-1 ring-inset",
        style.chipClass,
        style.ringClass,
        className,
      )}
    >
      <span className="truncate">{style.brandLabel}</span>
      <span className="opacity-60">·</span>
      <span className="font-mono tabular-nums">{style.gradeDisplay}</span>
    </span>
  );
}

function GradeCompactBadge({
  style,
  className,
}: {
  style: GraderBadgeStyle;
  className?: string;
}) {
  if (style.tier === "raw") return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-px font-mono text-[9px] font-bold uppercase tracking-wider",
        style.chipClass,
        className,
      )}
    >
      {style.brandLabel} {style.gradeNum ?? style.gradeDisplay}
    </span>
  );
}

function GradeGemBadge({
  style,
  fmvFallback,
  className,
}: {
  style: GraderBadgeStyle;
  fmvFallback?: string | null;
  className?: string;
}) {
  if (style.tier === "raw") {
    return (
      <div className={cn("flex h-full flex-col items-center justify-center px-3 py-4", className)}>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/15 ring-1 ring-emerald-500/30">
          <DollarSign className="h-5 w-5 text-emerald-300" aria-hidden />
        </div>
        <p className="mt-3 font-mono text-2xl font-semibold tabular-nums text-white">
          {fmvFallback ?? "—"}
        </p>
        <p className="mt-1 text-[11px] font-medium text-slate-400">FMV</p>
      </div>
    );
  }

  return (
    <div className={cn("flex h-full flex-col items-center justify-center px-3 py-4", className)}>
      <div
        className={cn(
          "relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br shadow-[0_8px_28px_-8px_rgba(0,0,0,0.65)] ring-1",
          style.gemGradient,
          style.ringClass,
        )}
        style={{ boxShadow: style.glowStyle }}
        aria-hidden
      >
        <span
          className="absolute inset-1 rounded-[0.65rem] bg-black/25"
          style={{ clipPath: GEM_CLIP }}
        />
        <span
          className={cn("relative h-7 w-7 rounded-lg bg-gradient-to-br opacity-95", style.gemGradient)}
          style={{ clipPath: GEM_CLIP }}
        />
      </div>
      <p className={cn("mt-3 font-mono text-[2rem] font-semibold leading-none tabular-nums text-white")}>
        {style.gradeNum ?? "—"}
      </p>
      <p className={cn("mt-0.5 max-w-[5.5rem] truncate text-center text-[11px] font-semibold", style.textClass)}>
        {style.brandLabel}
      </p>
      {style.qualifier ? (
        <p className="mt-0.5 max-w-[6rem] truncate text-center text-[9px] font-medium text-slate-400">
          {style.qualifier}
        </p>
      ) : null}
    </div>
  );
}
