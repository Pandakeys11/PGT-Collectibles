"use client";

import { BadgeCheck, Loader2 } from "lucide-react";
import type { ScanLaneMode } from "@/lib/scan/build-specimens";
import type { LiveGuideLayout } from "@/lib/scan/live-camera-frame";
import type { FrameQualityHint } from "@/lib/scan/live-camera-frame-analysis";
import { hintLabel } from "@/lib/scan/live-camera-frame-analysis";
import type { PokeGradeHudSnapshot } from "@/lib/pokegrade/types";
import { formatMarketUsd } from "@/lib/scan/specimen-market-view";
import { cn } from "@/lib/cn";

function GuideCutoutMask({ guide }: { guide: LiveGuideLayout }) {
  const left = guide.centerX - guide.width / 2;
  const top = guide.centerY - guide.height / 2;
  const right = left + guide.width;
  const bottom = top + guide.height;

  const panelClass = "absolute bg-black/78 backdrop-blur-[1px]";

  return (
    <>
      <div className={panelClass} style={{ top: 0, left: 0, right: 0, height: top }} aria-hidden />
      <div
        className={panelClass}
        style={{ top: bottom, left: 0, right: 0, bottom: 0 }}
        aria-hidden
      />
      <div
        className={panelClass}
        style={{ top, left: 0, width: left, height: guide.height }}
        aria-hidden
      />
      <div
        className={panelClass}
        style={{ top, left: right, right: 0, height: guide.height }}
        aria-hidden
      />
    </>
  );
}

function HudResultHero({ hud }: { hud: PokeGradeHudSnapshot }) {
  const artUrl = hud.catalogImageUrl?.trim() || hud.capturePreviewUrl?.trim() || null;

  return (
    <div className="pg-hud-result flex gap-3">
      <div className="pg-hud-result__art relative h-[4.5rem] w-[3.25rem] shrink-0 overflow-hidden rounded-lg border border-white/12 bg-black/40">
        {artUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={artUrl} alt="" className="h-full w-full object-contain p-0.5" draggable={false} />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[9px] text-slate-500">Art</div>
        )}
        {hud.catalogVerified ? (
          <span className="absolute bottom-0.5 right-0.5 rounded bg-emerald-500/90 p-0.5 text-white">
            <BadgeCheck className="h-3 w-3" aria-hidden />
          </span>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 font-display text-sm font-semibold leading-snug text-white">
          {hud.cardName}
        </p>
        <p className="mt-0.5 line-clamp-1 text-[10px] text-slate-400">{hud.subtitle}</p>
        {hud.gradeLine ? (
          <p className="mt-0.5 line-clamp-1 font-mono text-[9px] text-cyan-200/80">{hud.gradeLine}</p>
        ) : null}
        {hud.rarity ? (
          <p className="mt-1 inline-block rounded bg-white/8 px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-wide text-slate-300">
            {hud.rarity}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** Live camera overlay — adaptive card frame + instant match readout. */
export function PgtHelmetHudOverlay({
  hud,
  scanning,
  marketLoading,
  statusText,
  autoScanOn,
  laneMode,
  guide,
  hints = [],
  showCompactReadout = true,
  className,
}: {
  hud: PokeGradeHudSnapshot | null;
  scanning: boolean;
  marketLoading?: boolean;
  statusText?: string | null;
  autoScanOn?: boolean;
  laneMode: ScanLaneMode;
  guide: LiveGuideLayout | null;
  hints?: FrameQualityHint[];
  /** Hide chin readout when inline result sheet is showing. */
  showCompactReadout?: boolean;
  className?: string;
}) {
  const status = scanning
    ? "SCAN"
    : marketLoading
      ? "FMV"
      : hud
        ? "LOCK"
        : autoScanOn
          ? "LIVE"
          : "READY";
  const laneHint = laneMode === "graded" ? "Slab" : laneMode === "raw" ? "Raw card" : "Any card";
  const primaryHint = hints[0] ?? null;
  const hintText = primaryHint ? hintLabel(primaryHint) : null;

  const guideStyle = guide
    ? {
        width: guide.width,
        height: guide.height,
        left: guide.centerX - guide.width / 2,
        top: guide.centerY - guide.height / 2,
      }
    : null;

  return (
    <div
      className={cn("pg-helmet-hud pointer-events-none absolute inset-0 z-20", className)}
      aria-live="polite"
    >
      {guide ? <GuideCutoutMask guide={guide} /> : <div className="pg-helmet-mask" aria-hidden />}

      <div className="absolute left-0 right-0 top-0 z-30 flex justify-center px-3 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="pg-hud-bracket flex w-full max-w-md items-center justify-between gap-2 px-3 py-2">
          <div className="min-w-0">
            <span className="block font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
              PGT · Liquid Scan
            </span>
            <span className="block truncate text-[8px] text-slate-500">{laneHint} · auto frame</span>
          </div>
          <span
            className={cn(
              "shrink-0 font-mono text-[10px] font-bold tabular-nums",
              scanning ? "animate-pulse text-cyan-300" : hud ? "text-emerald-400" : "text-slate-400",
            )}
          >
            {status}
          </span>
        </div>
      </div>

      {guideStyle ? (
        <div
          className={cn(
            "pg-hud-reticle pg-helmet-visor absolute rounded-2xl border-2 transition-[width,height,left,top] duration-200 ease-out",
            scanning && "pg-helmet-visor-scanning",
            hud && !scanning && "pg-helmet-visor-locked",
            !scanning && !hud && "border-white/25 border-dashed",
          )}
          style={guideStyle}
        >
          <span className="absolute left-2 top-2 h-3.5 w-3.5 border-l-2 border-t-2 border-cyan-400/80" />
          <span className="absolute right-2 top-2 h-3.5 w-3.5 border-r-2 border-t-2 border-cyan-400/80" />
          <span className="absolute bottom-2 left-2 h-3.5 w-3.5 border-b-2 border-l-2 border-cyan-400/80" />
          <span className="absolute bottom-2 right-2 h-3.5 w-3.5 border-b-2 border-r-2 border-cyan-400/80" />
          {!scanning && !hud ? (
            <p
              className={cn(
                "absolute inset-x-0 bottom-3 text-center text-[9px] font-medium",
                hintText ? "text-amber-200/90" : "text-white/45",
              )}
            >
              {hintText ?? "Fill frame · flat · good light"}
            </p>
          ) : null}
        </div>
      ) : null}

      {showCompactReadout ? (
        <div className="absolute bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-0 right-0 z-30 flex justify-center px-3">
          <div className="pg-hud-panel w-full max-w-md px-3 py-2.5">
          {scanning || marketLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-cyan-300" />
              <p className="truncate font-mono text-[11px] text-cyan-100/95">
                {statusText ?? (marketLoading ? "Fetching FMV & comps…" : "Reading card & market…")}
              </p>
            </div>
          ) : hud ? (
              <div className="space-y-2.5">
                <HudResultHero hud={hud} />
                <div className="grid grid-cols-3 gap-2 border-t border-white/8 pt-2">
                  <div className="text-center">
                    <p className="text-[8px] font-semibold uppercase tracking-widest text-slate-500">FMV</p>
                    <p className="font-mono text-sm font-bold text-emerald-300">
                      {formatMarketUsd(hud.fairValueUsd)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[8px] font-semibold uppercase tracking-widest text-slate-500">PSA 10</p>
                    <p className="font-mono text-sm font-bold text-cyan-300">
                      {formatMarketUsd(hud.psa10SoldUsd)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[8px] font-semibold uppercase tracking-widest text-slate-500">Comps</p>
                    <p className="font-mono text-sm font-bold text-violet-200">
                      {hud.compsCount != null && hud.compsCount > 0 ? hud.compsCount : "—"}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p
                className={cn(
                  "text-center font-mono text-[10px] leading-relaxed",
                  hintText ? "text-amber-200/90" : "text-slate-400",
                )}
              >
                {statusText ??
                  hintText ??
                  (autoScanOn
                    ? "Center card in frame · rotates with your phone"
                    : "Tap Scan when the card fills the frame")}
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
