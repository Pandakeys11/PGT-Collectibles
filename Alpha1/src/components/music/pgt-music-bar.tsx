"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { MusicWaveform } from "@/components/music/music-waveform";
import { cn } from "@/lib/cn";
import { usePgtMusic } from "@/providers/pgt-music-provider";

/** Compact Omega-style row: prev | track | waveform | next */
export function PgtMusicBar({ className }: { className?: string }) {
  const { currentTrack, isPlaying, togglePlay, nextTrack, prevTrack } = usePgtMusic();

  return (
    <div className={cn("pgt-music-bar", className)}>
      <button
        type="button"
        className="pgt-music-bar__nav"
        onClick={prevTrack}
        aria-label="Previous track"
        title="Previous track"
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={2.5} aria-hidden />
      </button>

      <div className="pgt-music-bar__meta">
        <span className="pgt-music-bar__brand">PGT Player</span>
        <span className="pgt-music-bar__title">{currentTrack.label}</span>
        <span className="pgt-music-bar__subtitle">{currentTrack.sublabel}</span>
      </div>

      <button
        type="button"
        className="pgt-music-bar__wave-hit"
        onClick={togglePlay}
        aria-label={isPlaying ? "Pause" : "Play"}
        title={isPlaying ? "Pause" : "Play"}
      >
        <MusicWaveform playing={isPlaying} />
      </button>

      <button
        type="button"
        className="pgt-music-bar__nav"
        onClick={nextTrack}
        aria-label="Next track"
        title="Next track"
      >
        <ChevronRight className="h-4 w-4" strokeWidth={2.5} aria-hidden />
      </button>
    </div>
  );
}
