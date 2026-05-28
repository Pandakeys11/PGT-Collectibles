"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { MainWaveform } from "@/components/music/main-waveform";
import { useOmegaMusic } from "@/providers/omega-music-provider";

/** Core Omega Music card — prev/next, track label, clickable waveform. */
export function OmegaMusicPlayer({ compact = false }: { compact?: boolean }) {
  const {
    currentTrack,
    isAnyPlaying,
    handleOmegaPlayerClick,
    handleNextTrack,
    handlePrevTrack,
  } = useOmegaMusic();

  return (
    <div className={compact ? "omega-music-player omega-music-player--compact" : "omega-music-player"}>
      <div className="omega-music-player__header">
        <span className="omega-music-player__brand">Omega Music</span>
      </div>

      <div className="omega-music-player__controls">
        <button
          type="button"
          className="omega-music-player__nav"
          onClick={(e) => {
            e.stopPropagation();
            handlePrevTrack();
          }}
          title="Previous track"
          aria-label="Previous track"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
        </button>

        <div className="omega-music-player__meta">
          <span className="omega-music-player__title">{currentTrack.label}</span>
          <span className="omega-music-player__subtitle">{currentTrack.sublabel}</span>
        </div>

        <button
          type="button"
          className="omega-music-player__nav"
          onClick={(e) => {
            e.stopPropagation();
            handleNextTrack();
          }}
          title="Next track"
          aria-label="Next track"
        >
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>

      <button
        type="button"
        className="omega-music-player__waveform-hit"
        onClick={() => handleOmegaPlayerClick(currentTrack.id)}
        title={isAnyPlaying ? "Pause" : "Play"}
        aria-label={isAnyPlaying ? "Pause track" : "Play track"}
      >
        <MainWaveform
          isPlaying={isAnyPlaying}
          className="omega-music-player__waveform"
          barClassName="omega-music-player__bar"
          playingClassName="omega-music-player__waveform--playing"
        />
      </button>
    </div>
  );
}
