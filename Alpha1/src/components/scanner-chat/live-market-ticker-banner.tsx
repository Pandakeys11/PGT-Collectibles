"use client";

import { TrendingUp } from "lucide-react";
import { LiveMarketTickerPill } from "@/components/scanner-chat/live-market-ticker-pill";
import { useLiveMarketTicker } from "@/hooks/use-live-market-ticker";
import { cn } from "@/lib/cn";

/**
 * Desktop compact strip: three live market pills — different sets & cards at once.
 */
export function LiveMarketTickerBanner({
  onOpenFull,
  className,
}: {
  onOpenFull: () => void;
  className?: string;
}) {
  const ticker = useLiveMarketTicker();
  const { loading, error, paused, setPaused, bannerPills } = ticker;

  if (loading && bannerPills.length === 0) {
    return (
      <div
        className={cn(
          "sc-live-market-banner flex items-center justify-center rounded-xl border border-sky-500/20 bg-sky-500/[0.05] px-3 py-2 text-[11px] text-muted",
          className,
        )}
      >
        <TrendingUp className="mr-2 h-3.5 w-3.5 animate-pulse text-sky-400" aria-hidden />
        Loading live market pulse…
      </div>
    );
  }

  if (!bannerPills.length) {
    if (error) {
      return (
        <div
          className={cn(
            "sc-live-market-banner flex items-center justify-between gap-2 rounded-xl border border-rose-500/25 bg-rose-500/[0.06] px-3 py-2",
            className,
          )}
        >
          <p className="text-[11px] text-rose-300">{error}</p>
          <button
            type="button"
            className="shrink-0 rounded-md bg-white/10 px-2 py-1 text-[10px] font-medium text-primary"
            onClick={() => void ticker.reload()}
          >
            Retry
          </button>
        </div>
      );
    }
    return null;
  }

  return (
    <div
      className={cn("sc-live-market-banner-row", className)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className={cn(
          "sc-live-market-banner-track flex gap-2 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          !paused && bannerPills.length > 1 && "sc-live-market-banner-track--animate",
        )}
      >
        {bannerPills.map(({ laneId, lane, slide, index }) => (
          <LiveMarketTickerPill
            key={`${laneId}-${slide.setId}-${slide.catalogId}`}
            slide={slide}
            laneLabel={lane.label}
            slideIndex={index}
            slideTotal={lane.slides.length}
            onClick={onOpenFull}
            className="min-w-[min(100%,14rem)] shrink-0 sm:min-w-0 sm:flex-1"
          />
        ))}
      </div>
      <button
        type="button"
        onClick={onOpenFull}
        className="sc-live-market-banner-open mt-1.5 w-full rounded-lg border border-sky-500/20 bg-sky-500/10 py-1.5 text-center text-[10px] font-semibold text-sky-200 transition hover:bg-sky-500/15 touch-manipulation"
      >
        Vault pulse · full market tour
      </button>
    </div>
  );
}
