"use client";

import { Loader2 } from "lucide-react";
import type { PokeGradeHudSnapshot } from "@/lib/pokegrade/types";
import { formatMarketUsd } from "@/lib/scan/specimen-market-view";
import { cn } from "@/lib/cn";

export function PokeGradeHudOverlay({
  hud,
  scanning,
  statusText,
  className,
}: {
  hud: PokeGradeHudSnapshot | null;
  scanning: boolean;
  statusText?: string | null;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "pg-hud-root pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-3 sm:p-4",
        className,
      )}
      aria-live="polite"
    >
      {/* Visor top arc */}
      <div className="pg-hud-visor mx-auto mt-[max(0.5rem,env(safe-area-inset-top))] w-full max-w-md">
        <div className="pg-hud-bracket flex items-center justify-between gap-2 px-3 py-2">
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-cyan-300/90">
            PokeGrade · Live
          </span>
          <span className="font-mono text-[9px] text-emerald-400/80">
            {scanning ? "SCANNING" : hud ? "LOCKED" : "READY"}
          </span>
        </div>
      </div>

      {/* Center reticle */}
      <div className="pointer-events-none flex flex-1 items-center justify-center">
        <div
          className={cn(
            "pg-hud-reticle h-48 w-72 max-w-[85vw] rounded-[2rem] border-2 transition-colors sm:h-56 sm:w-80",
            scanning
              ? "border-cyan-400/50 shadow-[0_0_24px_rgb(34_211_238/0.25)]"
              : hud
                ? "border-emerald-400/60 shadow-[0_0_28px_rgb(16_185_129/0.3)]"
                : "border-white/25",
          )}
        />
      </div>

      {/* Bottom HUD panel — inside the mask */}
      <div className="pg-hud-panel mx-auto mb-[max(0.75rem,env(safe-area-inset-bottom))] w-full max-w-md">
        {scanning ? (
          <div className="flex items-center gap-2 px-4 py-3">
            <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />
            <p className="text-xs text-cyan-100/90">
              {statusText ?? "Reading card identity & market…"}
            </p>
          </div>
        ) : hud ? (
          <div className="space-y-2 px-4 py-3">
            <div>
              <p className="truncate font-display text-sm font-semibold text-white">
                {hud.cardName}
              </p>
              <p className="truncate text-[11px] text-slate-400">{hud.subtitle}</p>
              {hud.gradeLine ? (
                <p className="mt-0.5 font-mono text-[10px] text-amber-200/90">{hud.gradeLine}</p>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-2 border-t border-white/8 pt-2">
              <div>
                <p className="text-[9px] uppercase tracking-wider text-slate-500">Market FMV</p>
                <p className="font-mono text-lg font-semibold text-emerald-300">
                  {formatMarketUsd(hud.fairValueUsd)}
                </p>
                {hud.fairValueBasis ? (
                  <p className="text-[9px] text-slate-500">{hud.fairValueBasis}</p>
                ) : null}
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-wider text-slate-500">PSA 10</p>
                <p className="font-mono text-lg font-semibold text-cyan-300">
                  {formatMarketUsd(hud.psa10SoldUsd)}
                </p>
                {hud.psa10SoldLabel ? (
                  <p className="truncate text-[9px] text-slate-500">{hud.psa10SoldLabel}</p>
                ) : (
                  <p className="text-[9px] text-slate-600">Enriching comps…</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <p className="px-4 py-3 text-center text-[11px] text-slate-400">
            {statusText ?? "Center a card in the visor — auto-scan is on"}
          </p>
        )}
      </div>
    </div>
  );
}
