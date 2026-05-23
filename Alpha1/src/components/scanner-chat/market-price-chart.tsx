"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import type { ScanSpecimen } from "@/hooks/use-scan-session";
import type { MarketEvidence } from "@/lib/scan/schemas";
import {
  buildPriceChartPoints,
  priceChangeVsFmv,
  type PriceChartPoint,
} from "@/lib/scan/market-intelligence";
import { cn } from "@/lib/cn";

export function MarketPriceChart({
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
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<PriceChartPoint | null>(null);

  const points = useMemo(
    () => buildPriceChartPoints(specimen, evidence),
    [specimen, evidence],
  );
  const change = useMemo(
    () => priceChangeVsFmv(specimen, fmvOverride),
    [specimen, fmvOverride],
  );
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const chartId = specimen?.id ?? "empty";
  const up = (change.deltaUsd ?? 0) >= 0;

  const onPointerMove = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg || points.length === 0) return;
      const rect = svg.getBoundingClientRect();
      const xView = ((event.clientX - rect.left) / rect.width) * 100;
      let nearest = points[0];
      let best = Infinity;
      for (const point of points) {
        const d = Math.abs(point.x - xView);
        if (d < best) {
          best = d;
          nearest = point;
        }
      }
      setHover(nearest);
    },
    [points],
  );

  return (
    <div className={cn("rounded-xl border border-white/8 sc-glass-raised p-3", className)}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Market history
          </p>
          <p className="mt-0.5 text-xs text-slate-500">Priced comps over time</p>
        </div>
        {change.deltaUsd != null ? (
          <div
            className={cn(
              "flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-medium tabular-nums",
              up ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300",
            )}
          >
            {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {change.label}
            <span className="text-slate-600">vs FMV</span>
          </div>
        ) : null}
      </div>
      <div className="relative mt-3 h-32 rounded-lg border border-white/6 bg-[#070b10] bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:28px_28px] p-2">
        {points.length > 1 ? (
          <svg
            ref={svgRef}
            viewBox="0 0 100 100"
            className="h-full w-full cursor-crosshair overflow-visible"
            preserveAspectRatio="none"
            onPointerMove={onPointerMove}
            onPointerLeave={() => setHover(null)}
          >
            <defs>
              <linearGradient id={`marketFill-${chartId}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="rgba(52, 211, 153, 0.34)" />
                <stop offset="100%" stopColor="rgba(52, 211, 153, 0)" />
              </linearGradient>
            </defs>
            <polyline
              points={`0,95 ${line} 100,95`}
              fill={`url(#marketFill-${chartId})`}
              stroke="none"
            />
            <polyline
              points={line}
              fill="none"
              stroke="rgb(52 211 153)"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
            {points.map((point, index) => (
              <circle
                key={`${point.x}-${index}`}
                cx={point.x}
                cy={point.y}
                r={hover === point ? 3.2 : 1.9}
                fill={point.kind === "sold" ? "rgb(103 232 249)" : "rgb(251 191 36)"}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {hover ? (
              <g>
                <line
                  x1={hover.x}
                  x2={hover.x}
                  y1={8}
                  y2={92}
                  stroke="rgba(255,255,255,0.25)"
                  strokeDasharray="2 2"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            ) : null}
          </svg>
        ) : (
          <div className="grid h-full place-items-center text-center text-xs text-slate-600">
            Chart appears when multiple priced comps load.
          </div>
        )}
        {hover ? (
          <div
            className="pointer-events-none absolute z-30 rounded-lg border border-cyan-500/30 bg-slate-950/95 p-2 font-mono text-[10px] tabular-nums text-slate-100 shadow-xl max-w-[200px]"
            style={{
              left: `${hover.x}%`,
              top: `${hover.y}%`,
              transform: `translate(${hover.x > 80 ? "-85%" : hover.x < 20 ? "-15%" : "-50%"}, -115%)`,
            }}
          >
            {hover.title ? (
              <p className="font-sans font-semibold text-slate-200 truncate mb-1">{hover.title}</p>
            ) : null}
            <div className="flex items-center gap-1.5 font-medium text-slate-300">
              <span className="text-cyan-300">${Math.round(hover.price).toLocaleString()}</span>
              <span className="text-slate-500">·</span>
              <span>{hover.slab ?? "Raw"}</span>
            </div>
            <div className="mt-0.5 text-[9px] text-slate-500 flex items-center justify-between gap-3">
              <span className="capitalize">{hover.kind} · {hover.source ?? "eBay"}</span>
              <span>{hover.label}</span>
            </div>
          </div>
        ) : null}
      </div>
      <div className="mt-2 flex gap-3 font-mono text-[10px] text-slate-600">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-cyan-400" /> Sold
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-amber-400" /> Listed
        </span>
      </div>
    </div>
  );
}
