"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  TrendingUp,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLiveMarketTicker } from "@/hooks/use-live-market-ticker";
import { marketPokemonHref } from "@/lib/app-routes";
import type { LiveMarketTickerLaneId } from "@/lib/market/live-market-ticker-types";
import { LIVE_MARKET_TICKER_PANEL_LANE_ORDER } from "@/lib/market/live-market-ticker-types";
import type { CatalogScanPrefill } from "@/lib/scan/catalog-bridge";
import { WeeklyMoversStrip } from "@/components/market/weekly-movers-strip";
import { cn } from "@/lib/cn";

function fmtUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${Math.round(n).toLocaleString()}`;
}

export function LiveMarketTickerPanel({
  onCatalogScanPrefill,
  onDismiss,
  className,
}: {
  onCatalogScanPrefill?: (prefill: CatalogScanPrefill) => void;
  onDismiss?: () => void;
  className?: string;
}) {
  const ticker = useLiveMarketTicker();
  const [activeLane, setActiveLane] = useState<LiveMarketTickerLaneId>("top_value");
  const { loading, error, paused, setPaused, lanes, slideAt, laneIndex, advanceLane, goToLaneIndex } =
    ticker;
  const slide = slideAt(activeLane);
  const lane = lanes.find((l) => l.id === activeLane);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [slide?.catalogId]);

  const prefill: CatalogScanPrefill | null = slide
    ? {
        catalogId: slide.catalogId,
        name: slide.cardName,
        franchise: "pokemon",
        set: slide.setName,
        number: slide.cardNumber ?? undefined,
        year: slide.releaseYear ?? undefined,
        rarity: slide.rarity ?? undefined,
        catalogImageUrl: slide.imageUrl ?? undefined,
      }
    : null;

  const totalSets = useMemo(
    () => Math.max(...lanes.map((l) => l.slides.length), 0),
    [lanes],
  );

  return (
    <div className={cn("sc-live-market-panel flex min-h-0 min-w-0 flex-1 flex-col", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-sky-500/15 bg-sky-500/[0.06] px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <TrendingUp className="h-4 w-4 shrink-0 text-sky-300" aria-hidden />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-200/90">
              Live market pulse
            </p>
            <p className="truncate text-[10px] text-slate-500">
              {activeLane === "top_value" && ticker.payload?.topValueCount
                ? `${ticker.payload.topValueCount} sets · highest card each`
                : (lane?.subtitle ?? "Vintage → modern · full set tour")}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-muted"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? "Resume cycle" : "Pause cycle"}
          >
            {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-muted"
            disabled={loading}
            onClick={() => void ticker.reload()}
            aria-label="Refresh ticker"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </Button>
          {onDismiss ? (
            <button
              type="button"
              onClick={onDismiss}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-white/5"
              aria-label="Close live market"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      <div
        className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/6 px-2 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Market lane"
      >
        {LIVE_MARKET_TICKER_PANEL_LANE_ORDER.map((laneId) => {
          const meta = lanes.find((l) => l.id === laneId);
          if (!meta?.slides.length) return null;
          const active = activeLane === laneId;
          return (
            <button
              key={laneId}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveLane(laneId)}
              className={cn(
                "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium transition touch-manipulation",
                active
                  ? "bg-sky-500/20 text-sky-100 ring-1 ring-sky-400/30"
                  : "text-muted hover:bg-white/5 hover:text-primary",
              )}
            >
              {meta.label}
            </button>
          );
        })}
      </div>

      <div className="sc-live-market-panel__scroll min-h-0 flex-1 overflow-y-auto overscroll-contain scanner-chat-scrollbar touch-pan-y">
      <div
        className="relative min-h-[min(38vw,11rem)] p-3 max-lg:min-h-[10.5rem] sm:min-h-[15.5rem] lg:min-h-[14rem]"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {loading && !slide ? (
          <div className="flex h-full min-h-[12rem] items-center justify-center gap-2 text-sm text-muted">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            Building set market tour ({totalSets || "…"} sets)…
          </div>
        ) : error && !slide ? (
          <div className="flex h-full min-h-[10rem] flex-col items-center justify-center gap-2 text-center">
            <p className="text-xs text-danger">{error}</p>
            <Button type="button" size="sm" variant="secondary" onClick={() => void ticker.reload()}>
              Retry
            </Button>
          </div>
        ) : slide ? (
          <div className="flex h-full flex-col gap-3 sm:flex-row sm:items-stretch">
            <div className="mx-auto w-[min(42%,7.5rem)] shrink-0 sm:mx-0 sm:w-[6.75rem]">
              <div className="aspect-[2.5/3.5] overflow-hidden rounded-xl bg-black/40 ring-1 ring-white/10">
                {slide.imageUrl && !imgFailed ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={slide.catalogId}
                    src={slide.imageUrl}
                    alt=""
                    className="h-full w-full object-contain p-1"
                    onError={() => setImgFailed(true)}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-[10px] text-muted">
                    No art
                  </div>
                )}
              </div>
            </div>

            <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-300/90">
                  {slide.setName}
                  {slide.releaseYear ? ` · ${slide.releaseYear}` : ""}
                </p>
                <h3 className="mt-0.5 text-base font-semibold leading-snug text-primary line-clamp-2">
                  {slide.cardName}
                </h3>
                <p className="mt-0.5 text-[11px] text-muted">
                  {[slide.cardNumber ? `#${slide.cardNumber}` : null, slide.rarity]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>

              <div className="rounded-xl border border-sky-400/25 bg-gradient-to-r from-sky-500/10 to-transparent px-3 py-2">
                <p className="text-[9px] font-semibold uppercase tracking-wide text-faint">
                  {lane?.label ?? "Market"}
                </p>
                {slide.lane === "momentum" && slide.momentumPct != null ? (
                  <p
                    className={cn(
                      "font-mono text-2xl font-semibold leading-none",
                      slide.momentumPct >= 0 ? "text-emerald-300" : "text-rose-300",
                    )}
                  >
                    {slide.momentumPct > 0 ? "+" : ""}
                    {slide.momentumPct}%
                  </p>
                ) : (
                  <div className="space-y-1">
                    <p className="font-mono text-2xl font-semibold leading-none text-sky-200">
                      {fmtUsd(slide.rawFmvUsd ?? slide.priceUsd)}
                    </p>
                    {(slide.psa10FmvUsd != null || slide.tcgMarketUsd != null) && (
                      <p className="font-mono text-[11px] leading-tight text-slate-400">
                        {slide.psa10FmvUsd != null ? (
                          <span className="text-amber-200/90">
                            PSA 10 {fmtUsd(slide.psa10FmvUsd)}
                          </span>
                        ) : null}
                        {slide.psa10FmvUsd != null && slide.tcgMarketUsd != null ? (
                          <span className="text-faint"> · </span>
                        ) : null}
                        {slide.tcgMarketUsd != null ? (
                          <span>TCG {fmtUsd(slide.tcgMarketUsd)}</span>
                        ) : null}
                      </p>
                    )}
                  </div>
                )}
                <p className="mt-0.5 text-[10px] text-muted">{slide.priceLabel}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {prefill && onCatalogScanPrefill ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    className="h-8 text-xs"
                    onClick={() => onCatalogScanPrefill(prefill)}
                  >
                    Scan this card
                  </Button>
                ) : null}
                <Button type="button" size="sm" variant="secondary" className="h-8 text-xs" asChild>
                  <Link href={marketPokemonHref(slide.catalogId)}>
                    Market intel
                    <ExternalLink className="ml-1 h-3 w-3" aria-hidden />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {lane && lane.slides.length > 1 ? (
          <>
            <button
              type="button"
              className="absolute left-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white/90 ring-1 ring-white/10 backdrop-blur-sm touch-manipulation"
              onClick={() => advanceLane(activeLane, -1)}
              aria-label="Previous set"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white/90 ring-1 ring-white/10 backdrop-blur-sm touch-manipulation"
              onClick={() => advanceLane(activeLane, 1)}
              aria-label="Next set"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-white/6 px-2 py-2">
        <WeeklyMoversStrip compact />
      </div>
      </div>

      {lane && lane.slides.length > 0 ? (
        <footer className="flex items-center justify-between gap-2 border-t border-white/6 px-3 py-2">
          <p className="text-[10px] text-muted">
            Set <span className="font-mono text-slate-400">{laneIndex(activeLane) + 1}</span>
            <span className="text-faint"> / {lane.slides.length}</span>
            <span className="text-faint"> · {totalSets} sets in tour</span>
          </p>
          <div className="flex max-w-[55%] gap-0.5 overflow-hidden">
            {lane.slides.map((_, i) => (
              <button
                key={`dot-${activeLane}-${i}`}
                type="button"
                className={cn(
                  "h-1 flex-1 min-w-[3px] max-w-4 rounded-full transition",
                  i === laneIndex(activeLane) ? "bg-sky-400" : "bg-white/15",
                )}
                onClick={() => goToLaneIndex(activeLane, i)}
                aria-label={`Go to set ${i + 1}`}
              />
            ))}
          </div>
        </footer>
      ) : null}
    </div>
  );
}
