"use client";

import { useMemo, useRef } from "react";
import {
  createScanPipelineRun,
  evolutionStageForPipeline,
  evolutionTransitionForPipeline,
  pipelinePhaseLabel,
  spriteForPipelineRun,
  spritesToPreloadForRun,
  type ScanPipelineRun,
} from "@/lib/scanner-chat/scan-pipeline-evolution";
import { ScanPipelineTcgFrame } from "@/components/scanner-chat/scan-pipeline-tcg-frame";
import type { SystemChatMessage } from "@/lib/scanner-chat/types";

function useStablePipelineRun(sessionKey: string | null): ScanPipelineRun | null {
  const runRef = useRef<ScanPipelineRun | null>(null);
  if (!sessionKey) return runRef.current;
  if (!runRef.current || runRef.current.sessionKey !== sessionKey) {
    runRef.current = createScanPipelineRun(sessionKey);
  }
  return runRef.current;
}

export function ScanPipelineEvolutionArena({
  progress,
  sessionKey,
  steps = [],
  stepLabel,
  className,
}: {
  progress: number;
  sessionKey: string | null;
  steps?: SystemChatMessage[];
  stepLabel?: string | null;
  className?: string;
}) {
  const run = useStablePipelineRun(sessionKey);

  const stage = useMemo(
    () => evolutionStageForPipeline(steps, { statusHint: stepLabel }),
    [steps, stepLabel],
  );

  const transition = useMemo(
    () => evolutionTransitionForPipeline(steps, stepLabel),
    [steps, stepLabel],
  );

  const sprite = useMemo(
    () => (run ? spriteForPipelineRun(run, stage) : null),
    [run, stage],
  );

  const phaseLabel = useMemo(() => {
    if (!run || !sprite) return "Preparing scan…";
    return pipelinePhaseLabel(run, stage, transition, sprite);
  }, [run, stage, transition, sprite]);

  if (!run || !sprite) return null;

  const isRareFinale = run.lineId === "rare" && stage === 2;

  return (
    <ScanPipelineTcgFrame
      progress={progress}
      accent={run.accent}
      lineLabel={run.lineLabel}
      rare={run.lineId === "rare"}
      sprite={sprite}
      phaseLabel={phaseLabel}
      stepLabel={stepLabel}
      evolving={transition !== null}
      transformLegendary={isRareFinale}
      evolutionStage={stage}
      steps={steps}
      className={className}
    />
  );
}

export function preloadScanPipelineSprites(sessionKey: string | null): void {
  if (typeof window === "undefined" || !sessionKey) return;
  const run = createScanPipelineRun(sessionKey);
  for (const s of spritesToPreloadForRun(run)) {
    const img = new window.Image();
    img.src = `https://play.pokemonshowdown.com/sprites/ani/${s.slug}.gif`;
  }
}
