"use client";

import { useEffect, useState, type ComponentType } from "react";
import { VisionWebGLErrorBoundary } from "@/components/effects/vision-webgl-error-boundary";

function webglEnabled() {
  if (process.env.NEXT_PUBLIC_VISION_WEBGL === "0") return false;
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * Loads vision-field only in the browser; module/chunk failures never crash the shell.
 */
export function VisionFieldClient() {
  const [Field, setField] = useState<ComponentType | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!webglEnabled()) {
      setFailed(true);
      return;
    }

    let cancelled = false;
    void import("./vision-field")
      .then((mod) => {
        if (!cancelled) setField(() => mod.default);
      })
      .catch((error: unknown) => {
        if (process.env.NODE_ENV === "development") {
          console.warn(
            "[VisionField] WebGL chunk failed to load:",
            error instanceof Error ? error.message : error,
          );
        }
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (failed || !Field) return null;

  return (
    <VisionWebGLErrorBoundary>
      <Field />
    </VisionWebGLErrorBoundary>
  );
}
