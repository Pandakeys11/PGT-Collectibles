"use client";

import { ChevronRight, Tv } from "lucide-react";
import { MusicWaveform } from "@/components/music/music-waveform";
import { SidebarMarketPulse } from "@/components/scanner-chat/sidebar-market-pulse";
import { usePgtMusic } from "@/providers/pgt-music-provider";
import { cn } from "@/lib/cn";

/** Waveform play/pause + next — sidebar & collapsed rail. */
export function SidebarPgtPlayer({
  className,
  rail = false,
}: {
  className?: string;
  /** Ultra-narrow collapsed nav strip. */
  rail?: boolean;
}) {
  const { isPlaying, togglePlay, nextTrack } = usePgtMusic();

  if (rail) {
    return (
      <div className={cn("sc-sidebar-player-rail flex flex-col items-center gap-1", className)}>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] transition hover:border-emerald-500/35 hover:bg-emerald-500/10"
          onClick={togglePlay}
          aria-label={isPlaying ? "Pause PGT radio" : "Play PGT radio"}
          title={isPlaying ? "Pause" : "Play"}
        >
          <MusicWaveform playing={isPlaying} size="rail" />
        </button>
        <button
          type="button"
          className="flex h-7 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/5 hover:text-emerald-200"
          onClick={nextTrack}
          aria-label="Next track"
          title="Next track"
        >
          <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div className={cn("sc-sidebar-player flex items-center gap-1.5", className)}>
      <button
        type="button"
        className="pgt-music-bar__wave-hit sc-sidebar-player__wave flex min-w-0 flex-1 items-center justify-center rounded-lg border border-white/8 bg-black/30 py-1.5"
        onClick={togglePlay}
        aria-label={isPlaying ? "Pause PGT radio" : "Play PGT radio"}
        title={isPlaying ? "Pause" : "Play"}
      >
        <MusicWaveform playing={isPlaying} size="sidebar" />
      </button>
      <button
        type="button"
        className="pgt-music-bar__nav sc-sidebar-player__next shrink-0"
        onClick={nextTrack}
        aria-label="Next track"
        title="Next track"
      >
        <ChevronRight className="h-4 w-4" strokeWidth={2.5} aria-hidden />
      </button>
    </div>
  );
}

export function SidebarChrome({
  onOpenLiveMarket,
  onOpenPgtYoutube,
  className,
}: {
  onOpenLiveMarket: () => void;
  onOpenPgtYoutube?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("sc-sidebar-chrome shrink-0 space-y-2 border-b border-white/6 px-2 py-2.5", className)}>
      <SidebarMarketPulse onOpenFull={onOpenLiveMarket} />
      <div className="space-y-1">
        <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-faint">Media</p>
        <SidebarPgtPlayer />
        {onOpenPgtYoutube ? (
          <button
            type="button"
            onClick={onOpenPgtYoutube}
            className="flex w-full items-center gap-2 rounded-lg border border-white/8 bg-white/[0.03] px-2 py-1.5 text-left transition hover:border-violet-400/30 hover:bg-violet-500/[0.08]"
          >
            <Tv className="h-3.5 w-3.5 shrink-0 text-violet-300/90" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-xs text-slate-300">PGT Video</span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  );
}
