"use client";

import { DollarSign } from "lucide-react";
import { MarketSourceLogo } from "@/components/market/market-source-logo";
import type { FmvHeadline } from "@/lib/market/fmv-display";
import { cn } from "@/lib/cn";

function fmtLaneUsd(n: number | null): string {
  if (n == null) return "—";
  return `$${Math.round(n).toLocaleString()}`;
}

export function FmvHeadlineBlock({
  headline,
  size = "default",
  className,
}: {
  headline: FmvHeadline;
  size?: "compact" | "default" | "hero";
  className?: string;
}) {
  const held = headline.held;
  const hasAmount = !held && headline.amountUsd != null && headline.amountUsd > 0;

  return (
    <div
      className={cn(
        "rounded-lg border px-2.5 py-2",
        held
          ? "border-amber-500/30 bg-amber-500/8"
          : hasAmount
            ? "border-emerald-500/25 bg-emerald-500/8"
            : "border-white/10 bg-white/[0.03]",
        size === "hero" && "px-3 py-2.5",
        className,
      )}
    >
      <p
        className={cn(
          "flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider",
          held ? "text-amber-300/95" : "text-emerald-400/90",
        )}
      >
        <DollarSign className="h-3 w-3 shrink-0" aria-hidden />
        {held ? "FMV pending confirm" : "Fair market value"}
      </p>
      <p
        className={cn(
          "font-mono font-semibold tabular-nums",
          size === "hero" ? "text-2xl" : size === "compact" ? "text-sm" : "text-base sm:text-lg",
          held ? "text-amber-200/90" : hasAmount ? "text-emerald-300" : "text-slate-500",
        )}
      >
        {headline.amount}
      </p>
      <p className="mt-0.5 text-[9px] leading-snug text-slate-500">
        {held
          ? (headline.holdMessage ?? "Confirm identity first")
          : [headline.basisLabel, headline.sourceLabel].filter(Boolean).join(" · ") ||
            "From sold comps & market data"}
      </p>
      {!held && headline.lanes.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {headline.lanes.map((lane) => (
            <span
              key={`${lane.sourceId}-${lane.lane}`}
              className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-black/30 px-1.5 py-0.5 text-[8px] text-slate-300"
              title={`${lane.label} · ${lane.lane}`}
            >
              <MarketSourceLogo
                label={lane.label}
                sourceId={lane.sourceId as import("@/lib/market/sources").MarketSourceId}
                className="h-3 w-3 shrink-0 opacity-90"
              />
              <span className="font-medium text-slate-400">{lane.label}</span>
              <span className="font-mono tabular-nums text-amber-200/95">{fmtLaneUsd(lane.usd)}</span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
