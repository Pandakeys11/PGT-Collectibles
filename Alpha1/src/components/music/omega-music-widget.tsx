"use client";

import { Music2, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { OmegaMusicPlayer } from "@/components/music/omega-music-player";
import { cn } from "@/lib/cn";
import { isFullBleedScannerPath } from "@/lib/route-paths";
import { useOmegaMusic } from "@/providers/omega-music-provider";

const COLLAPSE_KEY = "pgt.omega-music.collapsed";

function readCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Persistent Omega Music widget — fixed bottom-left, adapts to Liquid Scan vs standard routes. */
export function OmegaMusicWidget() {
  const pathname = usePathname();
  const isLiquidScan = isFullBleedScannerPath(pathname);
  const { currentTrack, isAnyPlaying, toggleCurrentTrack } = useOmegaMusic();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setCollapsed(readCollapsed());
    setMounted(true);
  }, []);

  const setCollapsedPersist = useCallback((next: boolean) => {
    setCollapsed(next);
    try {
      window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  if (!mounted) return null;

  return (
    <div
      className={cn(
        "omega-music-widget pointer-events-none fixed z-[38]",
        isLiquidScan
          ? "bottom-[calc(var(--sc-composer-height,7.5rem)+env(safe-area-inset-bottom,0px)+0.5rem)] left-3 sm:left-4"
          : "bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px)+0.5rem)] left-3 sm:left-4 lg:bottom-6",
      )}
      aria-live="polite"
    >
      {collapsed ? (
        <button
          type="button"
          className="omega-music-widget__pill pointer-events-auto"
          onClick={() => setCollapsedPersist(false)}
          title="Open Omega Music"
          aria-label="Open Omega Music player"
        >
          <Music2 className="h-4 w-4 shrink-0" aria-hidden />
          <span className="omega-music-widget__pill-label">{currentTrack.label}</span>
          <span
            className={cn(
              "omega-music-widget__pill-dot",
              isAnyPlaying && "omega-music-widget__pill-dot--live",
            )}
            aria-hidden
          />
        </button>
      ) : (
        <div className="omega-music-widget__panel pointer-events-auto">
          <div className="omega-music-widget__panel-chrome">
            <button
              type="button"
              className="omega-music-widget__icon-btn"
              onClick={toggleCurrentTrack}
              title={isAnyPlaying ? "Pause" : "Play"}
              aria-label={isAnyPlaying ? "Pause" : "Play"}
            >
              <Music2 className="h-3.5 w-3.5" aria-hidden />
            </button>
            <button
              type="button"
              className="omega-music-widget__icon-btn omega-music-widget__icon-btn--close"
              onClick={() => setCollapsedPersist(true)}
              title="Minimize player"
              aria-label="Minimize Omega Music player"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
          <OmegaMusicPlayer compact />
        </div>
      )}
    </div>
  );
}
