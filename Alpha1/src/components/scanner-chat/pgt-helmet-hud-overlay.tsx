"use client";

import { Loader2 } from "lucide-react";
import type { PokeGradeHudSnapshot } from "@/lib/pokegrade/types";
import { formatMarketUsd } from "@/lib/scan/specimen-market-view";
import { cn } from "@/lib/cn";

/** Helmet visor HUD — short telemetry only, overlaid on live camera (not native picker). */
export function PgtHelmetHudOverlay({
  hud,
  scanning,
  statusText,
  autoScanOn,
  className,
}: {
  hud: PokeGradeHudSnapshot | null;
  scanning: boolean;
  statusText?: string | null;
  autoScanOn?: boolean;
  className?: string;
}) {
  const status = scanning ? "SCAN" : hud ? "LOCK" : autoScanOn ? "LIVE" : "READY";

  return (
    <div
      className={cn("pg-helmet-hud pointer-events-none absolute inset-0 z-20", className)}
      aria-live="polite"
    >
      {/* Helmet mask — dark edges, clear visor window */}
      <div className="pg-helmet-mask" aria-hidden />
      <div className="pg-helmet-cheek pg-helmet-cheek-left" aria-hidden />
      <div className="pg-helmet-cheek pg-helmet-cheek-right" aria-hidden />

      {/* Top telemetry bar */}
      <div className="absolute left-0 right-0 top-0 z-30 flex justify-center px-3 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="pg-hud-bracket flex w-full max-w-md items-center justify-between gap-3 px-3 py-2">
          <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.22em] text-cyan-300">
            PGT · Liquid Scan
          </span>
          <span
            className={cn(
              "font-mono text-[10px] font-bold tabular-nums",
              scanning ? "text-cyan-300 animate-pulse" : hud ? "text-emerald-400" : "text-slate-400",
            )}
          >
            {status}
          </span>
        </div>
      </div>

      {/* Visor reticle */}
      <div className="absolute inset-0 z-20 flex items-center justify-center">
        <div
          className={cn(
            "pg-hud-reticle pg-helmet-visor relative h-[42vh] w-[min(88vw,22rem)] max-h-72 rounded-[2.25rem] border-2",
            scanning && "pg-helmet-visor-scanning",
            hud && !scanning && "pg-helmet-visor-locked",
            !scanning && !hud && "border-white/20",
          )}
        >
          <span className="absolute left-3 top-3 h-4 w-4 border-l-2 border-t-2 border-cyan-400/70" />
          <span className="absolute right-3 top-3 h-4 w-4 border-r-2 border-t-2 border-cyan-400/70" />
          <span className="absolute bottom-3 left-3 h-4 w-4 border-b-2 border-l-2 border-cyan-400/70" />
          <span className="absolute bottom-3 right-3 h-4 w-4 border-b-2 border-r-2 border-cyan-400/70" />
        </div>
      </div>

      {/* Bottom readout — compact helmet chin display */}
      <div className="absolute bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-0 right-0 z-30 flex justify-center px-3">
        <div className="pg-hud-panel w-full max-w-md px-3 py-2.5">
          {scanning ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-cyan-300" />
              <p className="truncate font-mono text-[11px] text-cyan-100/95">
                {statusText ?? "Reading slab tag & market…"}
              </p>
            </div>
          ) : hud ? (
            <div className="space-y-1.5">
              <p className="truncate text-center font-display text-sm font-semibold leading-tight text-white">
                {hud.cardName}
              </p>
              <p className="truncate text-center font-mono text-[10px] text-slate-400">
                {[hud.subtitle, hud.gradeLine].filter(Boolean).join(" · ")}
              </p>
              <div className="flex items-stretch justify-center gap-4 border-t border-white/8 pt-2">
                <div className="text-center">
                  <p className="text-[8px] font-semibold uppercase tracking-widest text-slate-500">FMV</p>
                  <p className="font-mono text-base font-bold text-emerald-300">
                    {formatMarketUsd(hud.fairValueUsd)}
                  </p>
                </div>
                <div className="w-px bg-white/10" />
                <div className="text-center">
                  <p className="text-[8px] font-semibold uppercase tracking-widest text-slate-500">PSA 10</p>
                  <p className="font-mono text-base font-bold text-cyan-300">
                    {formatMarketUsd(hud.psa10SoldUsd)}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-center font-mono text-[10px] leading-relaxed text-slate-400">
              {statusText ??
                (autoScanOn
                  ? "Center card in visor · auto-scan active"
                  : "Tap Scan to identify card")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
