"use client";

import { cn } from "@/lib/cn";

const WAVE_BARS = { default: 24, sidebar: 16, rail: 8 } as const;

/** Animated waveform bars — Omega-style player visual. */
export function MusicWaveform({
  playing,
  className,
  size = "default",
}: {
  playing: boolean;
  className?: string;
  size?: keyof typeof WAVE_BARS;
}) {
  const count = WAVE_BARS[size];
  return (
    <div
      className={cn(
        "pgt-music-wave",
        size !== "default" && `pgt-music-wave--${size}`,
        playing && "pgt-music-wave--playing",
        className,
      )}
      role="img"
      aria-label={playing ? "Playing" : "Paused"}
    >
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className="pgt-music-wave__bar"
          style={{ animationDelay: `${i * 0.1}s` }}
        />
      ))}
    </div>
  );
}
