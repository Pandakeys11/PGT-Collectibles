"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import type { LiveMarketTickerLaneId, LiveMarketTickerSlide } from "@/lib/market/live-market-ticker-types";
import { cn } from "@/lib/cn";

function fmtUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${Math.round(n).toLocaleString()}`;
}

const LANE_ACCENT: Record<LiveMarketTickerLaneId, string> = {
  top_value: "text-sky-300",
  momentum: "text-emerald-300",
  spotlight: "text-amber-300",
  jpn_art: "text-violet-300",
};

export function LiveMarketTickerPill({
  slide,
  laneLabel,
  slideIndex,
  slideTotal,
  onClick,
  onMouseEnter,
  onMouseLeave,
  className,
}: {
  slide: LiveMarketTickerSlide;
  laneLabel: string;
  slideIndex: number;
  slideTotal: number;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  className?: string;
}) {
  const accent = LANE_ACCENT[slide.lane];
  const momentum = slide.momentumPct;
  const up = momentum != null && momentum >= 0;

  const inner = (
    <>
      <div className="flex shrink-0 items-center gap-1">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-sky-400" />
        </span>
        <span className="text-[8px] font-bold uppercase tracking-wider text-sky-200/80">Live</span>
      </div>

      {slide.imageUrl ? (
        <div className="h-8 w-[1.45rem] shrink-0 overflow-hidden rounded-md bg-black/40 ring-1 ring-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={slide.imageUrl} alt="" className="h-full w-full object-contain p-px" />
        </div>
      ) : null}

      <div className="min-w-0 flex-1">
        <p className="truncate text-[10px] font-medium leading-tight text-primary">
          <span className={cn("opacity-90", accent)}>{slide.setName}</span>
          <span className="text-faint"> · </span>
          {slide.cardName}
        </p>
        <p className="truncate text-[9px] leading-tight text-muted">
          {laneLabel}
          {slide.lane === "jpn_art" ? (
            <span className="ml-1 font-mono text-violet-200/90">{fmtUsd(slide.priceUsd)}</span>
          ) : slide.lane === "momentum" && momentum != null ? (
            <span
              className={cn(
                "ml-1 inline-flex items-center gap-0.5 font-mono font-semibold",
                up ? "text-emerald-300" : "text-rose-300",
              )}
            >
              {up ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
              {momentum > 0 ? "+" : ""}
              {momentum}%
            </span>
          ) : (
            <span className="ml-1 font-mono text-sky-200/90">
              {fmtUsd(slide.rawFmvUsd ?? slide.priceUsd)}
              {slide.psa10FmvUsd != null && slide.lane === "top_value" ? (
                <span className="text-faint">
                  {" "}
                  · PSA10 {fmtUsd(slide.psa10FmvUsd)}
                </span>
              ) : null}
            </span>
          )}
          {slideTotal > 1 ? (
            <span className="text-faint">
              {" "}
              · {slideIndex + 1}/{slideTotal}
            </span>
          ) : null}
        </p>
      </div>
    </>
  );

  const shellClass = cn(
    "sc-live-market-pill flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-sky-500/20 bg-gradient-to-r from-sky-500/[0.07] to-transparent px-2 py-1.5 transition",
    className,
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className={cn(shellClass, "text-left touch-manipulation hover:border-sky-400/35 hover:from-sky-500/[0.11]")}
        aria-label={`${laneLabel}: ${slide.setName} ${slide.cardName}`}
      >
        {inner}
      </button>
    );
  }

  return <div className={shellClass}>{inner}</div>;
}
