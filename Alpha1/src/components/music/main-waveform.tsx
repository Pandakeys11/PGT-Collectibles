"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

type MainWaveformProps = {
  isPlaying: boolean;
  className?: string;
  barClassName?: string;
  playingClassName?: string;
};

/** 24-bar animated waveform — shared with Omega Terminal music player. */
export function MainWaveform({
  isPlaying,
  className,
  barClassName,
  playingClassName,
}: MainWaveformProps) {
  const waveformRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!waveformRef.current) return;
    const bars = waveformRef.current.children;
    for (let i = 0; i < bars.length; i += 1) {
      (bars[i] as HTMLElement).style.animationDelay = `${i * 0.1}s`;
    }
  }, []);

  return (
    <div
      ref={waveformRef}
      className={cn(className, isPlaying && playingClassName)}
      aria-label={isPlaying ? "Playing" : "Paused"}
      role="img"
    >
      {Array.from({ length: 24 }).map((_, i) => (
        <div key={i} className={barClassName} />
      ))}
    </div>
  );
}
