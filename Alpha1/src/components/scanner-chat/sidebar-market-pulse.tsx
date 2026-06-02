"use client";

import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { LiveMarketTickerPill } from "@/components/scanner-chat/live-market-ticker-pill";
import { useLiveMarketTicker } from "@/hooks/use-live-market-ticker";
import { cn } from "@/lib/cn";

/**
 * Live market pulse for the left nav — one rotating pill + open tour.
 */
export function SidebarMarketPulse({
  onOpenFull,
  className,
  compact = false,
}: {
  onOpenFull: () => void;
  className?: string;
  /** Collapsed icon rail — icon only with tooltip label. */
  compact?: boolean;
}) {
  const ticker = useLiveMarketTicker();
  const { loading, error, paused, setPaused, bannerPills, payload, reload } = ticker;
  const [idx, setIdx] = useState(0);
  const topValueTotal =
    payload?.topValueCount ?? payload?.lanes.find((l) => l.id === "top_value")?.slides.length ?? 0;

  useEffect(() => {
    setIdx(0);
  }, [bannerPills.length]);

  useEffect(() => {
    if (bannerPills.length <= 1 || paused) return;
    const t = window.setInterval(() => {
      setIdx((i) => (i + 1) % bannerPills.length);
    }, 5500);
    return () => window.clearInterval(t);
  }, [bannerPills.length, paused]);

  const active = bannerPills[idx] ?? bannerPills[0];

  if (compact) {
    return (
      <button
        type="button"
        onClick={onOpenFull}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-lg border border-sky-500/25 bg-sky-500/10 text-sky-300 transition hover:border-sky-400/40 hover:bg-sky-500/15",
          className,
        )}
        aria-label="Open live market pulse"
        title="Live market pulse"
      >
        <TrendingUp className="h-4 w-4" aria-hidden />
      </button>
    );
  }

  if (loading && bannerPills.length === 0) {
    return (
      <div
        className={cn(
          "sc-sidebar-market-pulse flex items-center gap-2 rounded-xl border border-sky-500/20 bg-sky-500/[0.06] px-2.5 py-2 text-[10px] text-muted",
          className,
        )}
      >
        <TrendingUp className="h-3.5 w-3.5 shrink-0 animate-pulse text-sky-400" aria-hidden />
        Loading pulse…
      </div>
    );
  }

  if (!bannerPills.length) {
    if (error) {
      return (
        <div
          className={cn(
            "sc-sidebar-market-pulse rounded-xl border border-rose-500/25 bg-rose-500/[0.06] px-2.5 py-2",
            className,
          )}
        >
          <p className="text-[10px] leading-snug text-rose-300">{error}</p>
          <button
            type="button"
            className="mt-1.5 w-full rounded-md bg-white/10 py-1 text-[10px] font-medium text-primary"
            onClick={() => void reload()}
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
      className={cn("sc-sidebar-market-pulse space-y-1", className)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <p className="flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-300/80">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-50" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-sky-400" />
        </span>
        Live pulse
      </p>
      {active ? (
        <LiveMarketTickerPill
          className="sc-sidebar-market-pulse__pill w-full"
          slide={active.slide}
          laneLabel={active.lane.label}
          slideIndex={active.index}
          slideTotal={active.lane.slides.length}
          onClick={onOpenFull}
        />
      ) : null}
      <button
        type="button"
        onClick={onOpenFull}
        className="w-full rounded-lg py-1 text-center text-[10px] font-medium text-sky-300/90 transition hover:bg-sky-500/10 hover:text-sky-200"
      >
        {topValueTotal > 0 ? `Browse ${topValueTotal} sets` : "Open pulse"}
      </button>
    </div>
  );
}
