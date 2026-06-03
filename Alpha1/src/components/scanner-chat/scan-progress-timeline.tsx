"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  activePipelineStepLabel,
  computeScanPipelineProgress,
} from "@/lib/scanner-chat/scan-pipeline-evolution";
import {
  ScanPipelineEvolutionArena,
  preloadScanPipelineSprites,
} from "@/components/scanner-chat/scan-pipeline-evolution-arena";
import { cn } from "@/lib/cn";

export function ScanProgressTimeline({
  steps,
  bootstrapping = false,
  statusText,
  scanSessionKey = null,
  className,
}: {
  steps: SystemChatMessage[];
  bootstrapping?: boolean;
  statusText?: string | null;
  scanSessionKey?: string | null;
  className?: string;
}) {
  const fallbackKeyRef = useRef<string | null>(null);
  if (bootstrapping && !scanSessionKey && !fallbackKeyRef.current) {
    fallbackKeyRef.current = `scan-${Date.now()}`;
  }
  if (!bootstrapping && steps.every((s) => s.done)) {
    fallbackKeyRef.current = null;
  }

  const sessionKey = scanSessionKey ?? fallbackKeyRef.current;

  useEffect(() => {
    if (sessionKey) preloadScanPipelineSprites(sessionKey);
  }, [sessionKey]);

  const progress = useMemo(
    () => computeScanPipelineProgress(steps, { bootstrapping }),
    [steps, bootstrapping],
  );

  const stepLabel = activePipelineStepLabel(steps) ?? statusText?.trim() ?? null;

  if (!steps.length && !bootstrapping) return null;

  return (
    <div className={cn("sc-scan-pipeline-panel flex justify-center", className)}>
      <ScanPipelineEvolutionArena
        progress={progress}
        sessionKey={sessionKey}
        steps={steps}
        stepLabel={stepLabel}
      />
    </div>
  );
}
