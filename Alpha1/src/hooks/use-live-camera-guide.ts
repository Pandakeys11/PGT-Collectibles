"use client";

import { useEffect, useMemo, useState, type RefObject } from "react";
import type { ScanLaneMode } from "@/lib/scan/build-specimens";
import {
  computeLiveGuideLayout,
  type LiveGuideLayout,
} from "@/lib/scan/live-camera-frame";

export function useLiveCameraGuide(
  containerRef: RefObject<HTMLElement | null>,
  laneMode: ScanLaneMode,
  active: boolean,
): { guide: LiveGuideLayout | null; containerSize: { width: number; height: number } } {
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!active) return;
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      setContainerSize({ width: rect.width, height: rect.height });
    };

    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    window.addEventListener("orientationchange", measure);
    window.addEventListener("resize", measure);

    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", measure);
      window.removeEventListener("resize", measure);
    };
  }, [active, containerRef]);

  const guide = useMemo(() => {
    if (!active || containerSize.width < 40 || containerSize.height < 40) return null;
    return computeLiveGuideLayout(containerSize, laneMode);
  }, [active, containerSize, laneMode]);

  return { guide, containerSize };
}
