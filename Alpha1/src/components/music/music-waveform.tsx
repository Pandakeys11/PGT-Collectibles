"use client";

import { cn } from "@/lib/cn";

/** 24-bar waveform — matches Omega Terminal player animation. */
export function MusicWaveform({ playing, className }: { playing: boolean; className?: string }) {
  return (
    <div
      className={cn("pgt-music-wave", playing && "pgt-music-wave--playing", className)}
      role="img"
      aria-label={playing ? "Playing" : "Paused"}
    >
      {Array.from({ length: 24 }).map((_, i) => (
        <span
          key={i}
          className="pgt-music-wave__bar"
          style={{ animationDelay: `${i * 0.1}s` }}
        />
      ))}
    </div>
  );
}
