"use client";

import { useEffect, useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  Pause,
  Play,
  Tv,
  X,
} from "lucide-react";
import { useYoutubePlayer } from "@/hooks/use-youtube-player";
import { PGT_YOUTUBE_CHANNEL } from "@/lib/music/pgt-youtube-channel";
import { usePgtMusic } from "@/providers/pgt-music-provider";
import { cn } from "@/lib/cn";

export function PgtYoutubePlayerPanel({
  onDismiss,
  className,
}: {
  onDismiss?: () => void;
  className?: string;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const music = usePgtMusic();

  const player = useYoutubePlayer(mountRef, {
    videoId: PGT_YOUTUBE_CHANNEL.defaultVideoId,
    playlistId: PGT_YOUTUBE_CHANNEL.playlistId,
  });

  useEffect(() => {
    if (player.playing) music.pauseAll();
  }, [player.playing, music]);

  const displayTitle =
    player.videoTitle || PGT_YOUTUBE_CHANNEL.defaultVideoTitle;

  return (
    <div className={cn("sc-pgt-youtube-panel flex w-full min-w-0 flex-col", className)}>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-violet-500/20 bg-violet-500/[0.06] px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Tv className="h-4 w-4 shrink-0 text-violet-300" aria-hidden />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-200/90">
              PGT Video
            </p>
            <p className="truncate text-[10px] text-slate-500">{PGT_YOUTUBE_CHANNEL.label} playlist</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <a
            href={PGT_YOUTUBE_CHANNEL.playlistUrl}
            target="_blank"
            rel="noreferrer"
            className="flex h-8 items-center gap-1 rounded-lg px-2 text-[10px] font-medium text-slate-400 transition hover:bg-white/5 hover:text-violet-200"
            title="Open on YouTube"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">YouTube</span>
          </a>
          {onDismiss ? (
            <button
              type="button"
              onClick={onDismiss}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/5"
              aria-label="Close PGT Video"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="sc-pgt-youtube-panel__body px-3 py-3 sm:px-4">
        <div className="sc-pgt-youtube-player overflow-hidden rounded-xl border border-violet-500/25 bg-black shadow-[0_12px_40px_rgb(0_0_0/0.45)]">
          <div className="sc-pgt-youtube-player__stage relative w-full bg-black">
            <div ref={mountRef} className="sc-pgt-youtube-player__mount absolute inset-0" />
            {!player.ready && !player.error ? (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80">
                <Loader2 className="h-6 w-6 animate-spin text-violet-300" aria-hidden />
                <p className="text-[11px] text-slate-400">Loading PGT Video…</p>
              </div>
            ) : null}
            {player.error ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/90 px-4 text-center">
                <p className="text-sm text-rose-300">{player.error}</p>
                <a
                  href={PGT_YOUTUBE_CHANNEL.playlistUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-medium text-violet-300 underline-offset-2 hover:underline"
                >
                  Watch on YouTube
                </a>
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-3 border-t border-white/8 bg-gradient-to-r from-violet-950/50 via-black/60 to-cyan-950/30 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-semibold leading-snug text-slate-100">
                {displayTitle}
              </p>
              <p className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-500">
                {PGT_YOUTUBE_CHANNEL.label}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={player.prev}
                disabled={!player.ready}
                className="sc-pgt-youtube-panel__nav flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-200 transition hover:border-violet-400/35 hover:bg-violet-500/10 disabled:opacity-40"
                aria-label="Previous video"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={2.5} />
              </button>
              <button
                type="button"
                onClick={player.toggle}
                disabled={!player.ready}
                className="sc-pgt-youtube-panel__play flex h-10 w-10 items-center justify-center rounded-full border border-violet-400/40 bg-violet-500/15 text-violet-100 transition hover:bg-violet-500/25 disabled:opacity-40"
                aria-label={player.playing ? "Pause video" : "Play video"}
              >
                {player.playing ? (
                  <Pause className="h-4 w-4" fill="currentColor" />
                ) : (
                  <Play className="h-4 w-4 translate-x-0.5" fill="currentColor" />
                )}
              </button>
              <button
                type="button"
                onClick={player.next}
                disabled={!player.ready}
                className="sc-pgt-youtube-panel__nav flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-200 transition hover:border-violet-400/35 hover:bg-violet-500/10 disabled:opacity-40"
                aria-label="Next video"
              >
                <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
