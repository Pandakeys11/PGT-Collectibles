"use client";

import { useMemo, useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import type { ScanSpecimen } from "@/hooks/use-scan-session";
import type { MarketEvidence } from "@/lib/scan/schemas";
import {
  buildMarketPriceBubbles,
  formatPriceCompact,
  HEATMAP_LANES,
  type MarketBubbleInsight,
  type PriceBubbleCluster,
} from "@/lib/scan/market-heatmap";
import { priceChangeVsFmv } from "@/lib/scan/market-intelligence";
import { cn } from "@/lib/cn";

const INSIGHT_TONE: Record<MarketBubbleInsight["tone"], string> = {
  neutral: "text-slate-300",
  positive: "text-emerald-300/95",
  warning: "text-amber-300/95",
  info: "text-cyan-300/95",
};

export function MarketPriceHeatmap({
  specimen,
  evidence,
  fmvOverride,
  className,
}: {
  specimen: ScanSpecimen | null;
  evidence?: MarketEvidence[];
  fmvOverride?: number | null;
  className?: string;
}) {
  const pool = evidence ?? specimen?.context.marketEvidence ?? [];
  const change = useMemo(
    () => priceChangeVsFmv(specimen, fmvOverride),
    [specimen, fmvOverride],
  );
  const model = useMemo(
    () =>
      buildMarketPriceBubbles(pool, {
        fmvUsd: fmvOverride ?? specimen?.context.fairValueUsd ?? null,
      }),
    [pool, fmvOverride, specimen?.context.fairValueUsd],
  );
  const [hover, setHover] = useState<PriceBubbleCluster | null>(null);
  const up = (change.deltaUsd ?? 0) >= 0;

  return (
    <div className={cn("rounded-xl border border-white/8 sc-glass-raised p-3", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Price landscape
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Log-scale bubbles · bigger = more comps at that price
          </p>
        </div>
        {change.deltaUsd != null ? (
          <div
            className={cn(
              "shrink-0 flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-medium tabular-nums",
              up ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300",
            )}
          >
            {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {change.label}
          </div>
        ) : null}
      </div>

      {model ? (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
            <span className="rounded-md bg-white/5 px-1.5 py-0.5 font-mono text-slate-400">
              {model.rangeLabel}
            </span>
            <span className="text-slate-600">·</span>
            <span>{model.pricedCount} priced comps</span>
          </div>

          <div className="relative mt-2 overflow-hidden rounded-xl border border-white/6 bg-gradient-to-b from-[#0a1018] to-[#06090d]">
            <PriceBubbleCanvas
              model={model}
              hover={hover}
              onHover={setHover}
            />
          </div>

          {hover ? (
            <p className="mt-1.5 rounded-md bg-white/5 px-2 py-1 font-mono text-[10px] text-slate-300">
              {hover.title}
            </p>
          ) : (
            <p className="mt-1.5 text-[10px] text-slate-500">
              Hover a bubble for price band · left = cheaper · right = pricier
            </p>
          )}

          <div className="mt-2.5 rounded-lg border border-white/6 bg-black/25 px-2.5 py-2">
            <p className="text-[11px] font-medium leading-snug text-slate-200">{model.headline}</p>
            <ul className="mt-1.5 space-y-1">
              {model.insights.map((item, i) => (
                <li
                  key={i}
                  className={cn(
                    "flex gap-1.5 text-[10px] leading-relaxed before:shrink-0 before:content-['•']",
                    INSIGHT_TONE[item.tone],
                  )}
                >
                  {item.text}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-white/5 pt-2">
            {HEATMAP_LANES.map((lane) => (
              <span key={lane.id} className="inline-flex items-center gap-1.5 text-[9px] text-slate-500">
                <span
                  className="h-2.5 w-2.5 rounded-full ring-1 ring-white/20"
                  style={{ backgroundColor: lane.fill }}
                />
                {lane.label}
                <span className="font-mono text-slate-600">({model.totalByLane[lane.id]})</span>
              </span>
            ))}
            <span className="inline-flex items-center gap-1 text-[9px] text-slate-500">
              <span className="h-3 w-px bg-cyan-400" />
              FMV
              {model.fmvUsd != null ? (
                <span className="font-mono text-cyan-400/90">{formatPriceCompact(model.fmvUsd)}</span>
              ) : null}
            </span>
          </div>
        </>
      ) : (
        <div className="mt-3 grid h-36 place-items-center rounded-lg border border-dashed border-white/10 bg-black/20 px-4 text-center text-[11px] text-slate-500">
          Bubbles appear when enrich returns priced sold, listed, auction, or premium grade comps.
        </div>
      )}
    </div>
  );
}

function PriceBubbleCanvas({
  model,
  hover,
  onHover,
}: {
  model: NonNullable<ReturnType<typeof buildMarketPriceBubbles>>;
  hover: PriceBubbleCluster | null;
  onHover: (b: PriceBubbleCluster | null) => void;
}) {
  const laneHeight = 44;
  const chartH = HEATMAP_LANES.length * laneHeight + 28;
  const padL = 52;
  const padR = 8;
  const padT = 8;

  return (
    <div className="relative w-full" style={{ height: chartH }}>
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden
        preserveAspectRatio="none"
      >
        {model.axisTicks.map((tick) => (
          <line
            key={tick.label}
            x1={`${padL + (tick.xPct / 100) * (100 - padL - padR)}%`}
            y1={padT}
            x2={`${padL + (tick.xPct / 100) * (100 - padL - padR)}%`}
            y2="92%"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={1}
          />
        ))}
        {model.fmvXPct != null ? (
          <>
            <line
              x1={`${padL + (model.fmvXPct / 100) * (100 - padL - padR)}%`}
              y1={padT}
              x2={`${padL + (model.fmvXPct / 100) * (100 - padL - padR)}%`}
              y2="92%"
              stroke="rgba(34, 211, 238, 0.75)"
              strokeWidth={1.5}
              strokeDasharray="4 3"
            />
          </>
        ) : null}
      </svg>

      {HEATMAP_LANES.map((lane, laneIdx) => {
        const top = padT + laneIdx * laneHeight;
        const bubbles = model.laneBubbles[lane.id];
        const laneMeta = HEATMAP_LANES.find((l) => l.id === lane.id)!;

        return (
          <div
            key={lane.id}
            className="absolute left-0 right-0 border-b border-white/[0.04] last:border-0"
            style={{ top, height: laneHeight }}
          >
            <div className="absolute left-2 top-1/2 z-10 w-11 -translate-y-1/2">
              <p className="text-[9px] font-semibold leading-tight text-slate-400">{lane.short}</p>
              <p className="font-mono text-[8px] text-slate-600">{model.totalByLane[lane.id]}</p>
            </div>

            <div
              className="absolute bottom-0 top-0"
              style={{ left: `${padL}%`, right: `${padR}%` }}
            >
              {bubbles.length === 0 ? (
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[9px] text-slate-600">
                  —
                </span>
              ) : (
                bubbles.map((bubble, bi) => (
                  <BubbleNode
                    key={`${lane.id}-${bi}-${bubble.priceUsd}`}
                    bubble={bubble}
                    lane={laneMeta}
                    active={
                      hover?.lane === bubble.lane &&
                      hover.priceUsd === bubble.priceUsd &&
                      hover.count === bubble.count
                    }
                    onEnter={() => onHover(bubble)}
                    onLeave={() => onHover(null)}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}

      <div
        className="absolute bottom-1 left-0 right-0 flex justify-between px-2 font-mono text-[9px] text-slate-500"
        style={{ paddingLeft: `${padL}%`, paddingRight: `${padR}%` }}
      >
        {model.axisTicks.map((tick) => (
          <span
            key={tick.label}
            className="tabular-nums"
            style={{
              position: "absolute",
              left: `${padL + (tick.xPct / 100) * (100 - padL - padR)}%`,
              transform: "translateX(-50%)",
            }}
          >
            {tick.label}
          </span>
        ))}
      </div>

      {model.fmvUsd != null && model.fmvXPct != null ? (
        <div
          className="pointer-events-none absolute z-20 rounded bg-cyan-500/20 px-1 py-px text-[8px] font-semibold text-cyan-200 ring-1 ring-cyan-500/30"
          style={{
            left: `${padL + (model.fmvXPct / 100) * (100 - padL - padR)}%`,
            top: 2,
            transform: "translateX(-50%)",
          }}
        >
          FMV {formatPriceCompact(model.fmvUsd)}
        </div>
      ) : null}
    </div>
  );
}

function BubbleNode({
  bubble,
  lane,
  active,
  onEnter,
  onLeave,
}: {
  bubble: PriceBubbleCluster;
  lane: (typeof HEATMAP_LANES)[number];
  active: boolean;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const size = bubble.size + (active ? 4 : 0);

  return (
    <button
      type="button"
      className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      style={{
        left: `${bubble.xPct}%`,
        width: size,
        height: size,
        background: `radial-gradient(circle at 35% 30%, ${lane.fill}, ${lane.glow})`,
        boxShadow: active
          ? `0 0 16px ${lane.glow}, 0 0 0 2px ${lane.ring}`
          : `0 0 10px ${lane.glow}`,
        transform: `translate(-50%, -50%) scale(${active ? 1.08 : 1})`,
      }}
      title={bubble.title}
      aria-label={bubble.title}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
    >
      <span className="flex h-full w-full items-center justify-center font-mono text-[9px] font-bold tabular-nums text-slate-950/90">
        {bubble.label}
      </span>
    </button>
  );
}

/** @deprecated Use MarketPriceHeatmap — kept for existing imports. */
export function MarketPriceChart(props: Parameters<typeof MarketPriceHeatmap>[0]) {
  return <MarketPriceHeatmap {...props} />;
}
