"use client";

import { useEffect, useState, type RefObject } from "react";
import type { ScanLaneMode } from "@/lib/scan/build-specimens";
import type { LiveGuideLayout } from "@/lib/scan/live-camera-frame";
import {
  analyzeLiveCameraFrame,
  type FrameQualityHint,
  type LiveFrameAnalysis,
} from "@/lib/scan/live-camera-frame-analysis";

const ANALYSIS_INTERVAL_MS = 450;

export function useLiveCameraAnalysis(
  videoRef: RefObject<HTMLVideoElement | null>,
  containerSize: { width: number; height: number },
  baseGuide: LiveGuideLayout | null,
  laneMode: ScanLaneMode,
  active: boolean,
  paused: boolean,
): {
  activeGuide: LiveGuideLayout | null;
  hints: FrameQualityHint[];
  detected: LiveFrameAnalysis["detected"];
} {
  const [analysis, setAnalysis] = useState<LiveFrameAnalysis | null>(null);

  useEffect(() => {
    if (!active || paused || !baseGuide || containerSize.width < 40) {
      setAnalysis(null);
      return;
    }

    let cancelled = false;

    const tick = () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || cancelled) return;
      const next = analyzeLiveCameraFrame(video, containerSize, baseGuide, laneMode);
      if (!cancelled) setAnalysis(next);
    };

    tick();
    const id = window.setInterval(tick, ANALYSIS_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [active, paused, baseGuide, containerSize, laneMode, videoRef]);

  return {
    activeGuide: analysis?.activeGuide ?? baseGuide,
    hints: analysis?.hints ?? [],
    detected: analysis?.detected ?? null,
  };
}
