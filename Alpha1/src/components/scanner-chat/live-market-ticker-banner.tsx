"use client";

import { TrendingUp } from "lucide-react";
import { LiveMarketTickerPill } from "@/components/scanner-chat/live-market-ticker-pill";
import { useLiveMarketTicker } from "@/hooks/use-live-market-ticker";
import { cn } from "@/lib/cn";

/**
 * Desktop: three animated pills. Mobile: one compact pill + open button.
 */
export function LiveMarketTickerBanner({
  onOpenFull,
  className,
}: {
  onOpenFull: () => void;
  className?: string;
}) {
  const ticker = useLiveMarketTicker();
  const { loading, error, paused, setPaused, bannerPills, payload } = ticker;
  const topValueTotal = payload?.topValueCount ?? payload?.lanes.find((l) => l.id === "top_value")?.slides.length ?? 0;
  const leadPill = bannerPills[0];

  if (loading && bannerPills.length === 0) {
    return (
      <>
        <div
          className={cn(
            "sc-live-market-banner-mobile lg:hidden",
            className,
          )}
        >
          <div className="flex items-center justify-center gap-2 rounded-xl border border-sky-500/20 bg-sky-500/[0.05] px-3 py-2 text-[11px] text-muted">
            <TrendingUp className="h-3.5 w-3.5 animate-pulse text-sky-400" aria-hidden />
            Loading market pulse…
          </div>
        </div>
        <div
          className={cn(
            "sc-live-market-banner hidden lg:flex lg:items-center lg:justify-center lg:rounded-xl lg:border lg:border-sky-500/20 lg:bg-sky-500/[0.05] lg:px-3 lg:py-2 lg:text-[11px] lg:text-muted",
            className,
          )}
        >
          <TrendingUp className="mr-2 h-3.5 w-3.5 animate-pulse text-sky-400" aria-hidden />
          Loading top-value market pulse…
        </div>
      </>
    );
  }

  if (!bannerPills.length) {
    if (error) {
      return (
        <>
          <div className={cn("sc-live-market-banner-mobile lg:hidden", className)}>
            <div className="flex items-center justify-between gap-2 rounded-xl border border-rose-500/25 bg-rose-500/[0.06] px-3 py-2">
              <p className="text-[11px] text-rose-300">{error}</p>
              <button
                type="button"
                className="shrink-0 rounded-md bg-white/10 px-2 py-1 text-[10px] font-medium text-primary"
                onClick={() => void ticker.reload()}
              >
                Retry
              </button>
            </div>
          </div>
          <div
            className={cn(
              "sc-live-market-banner hidden lg:flex lg:items-center lg:justify-between lg:gap-2 lg:rounded-xl lg:border lg:border-rose-500/25 lg:bg-rose-500/[0.06] lg:px-3 lg:py-2",
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
        </>
      );
    }
    return null;
  }

  return (
    <>
      <div className={cn("sc-live-market-banner-mobile lg:hidden", className)}>
        {leadPill ? (
          <LiveMarketTickerPill
            className="sc-live-market-banner-mobile__pill"
            slide={leadPill.slide}
            laneLabel={leadPill.lane.label}
            slideIndex={leadPill.index}
            slideTotal={leadPill.lane.slides.length}
            onClick={onOpenFull}
          />
        ) : null}
        <button
          type="button"
          onClick={onOpenFull}
          className="sc-live-market-banner-mobile__open"
        >
          {topValueTotal > 0
            ? `Open market pulse · ${topValueTotal} sets`
            : "Open live market pulse"}
        </button>
      </div>

      <div
        className={cn("sc-live-market-banner-row hidden lg:block", className)}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div
          className={cn(
            "sc-live-market-banner-track flex gap-2",
            !paused && "sc-live-market-banner-track--animate",
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
            />
          ))}
        </div>
        <button
          type="button"
          onClick={onOpenFull}
          className="sc-live-market-banner-open mt-1.5 w-full rounded-lg border border-sky-500/20 bg-sky-500/10 py-1 text-center text-[10px] font-semibold text-sky-200 transition hover:bg-sky-500/15"
        >
          {topValueTotal > 0
            ? `Tour ${topValueTotal} set top values`
            : "Open full market tour"}
        </button>
      </div>
    </>
  );
}
