import { SYSTEM_SCAN_STEPS } from "@/lib/scanner-chat/mock-data";
import type { SystemChatMessage, SystemScanStep } from "@/lib/scanner-chat/types";

export type ScanPipelineLineId = "fire" | "grass" | "water" | "rare";
export type ScanPipelineAccent = "fire" | "grass" | "water" | "rare";

export type ScanPipelineSprite = {
  nationalId: number;
  slug: string;
  name: string;
  types: string[];
};

export type ScanPipelineLineDef = {
  label: string;
  accent: ScanPipelineAccent;
  stages: ScanPipelineSprite[];
};

/** Kanto starters + rare Pikachu → Ditto → random legendary. */
export const SCAN_PIPELINE_LINES: Record<ScanPipelineLineId, ScanPipelineLineDef> = {
  fire: {
    label: "Fire",
    accent: "fire",
    stages: [
      { nationalId: 4, slug: "charmander", name: "Charmander", types: ["fire"] },
      { nationalId: 5, slug: "charmeleon", name: "Charmeleon", types: ["fire"] },
      { nationalId: 6, slug: "charizard", name: "Charizard", types: ["fire", "flying"] },
    ],
  },
  grass: {
    label: "Grass",
    accent: "grass",
    stages: [
      { nationalId: 1, slug: "bulbasaur", name: "Bulbasaur", types: ["grass", "poison"] },
      { nationalId: 2, slug: "ivysaur", name: "Ivysaur", types: ["grass", "poison"] },
      { nationalId: 3, slug: "venusaur", name: "Venusaur", types: ["grass", "poison"] },
    ],
  },
  water: {
    label: "Water",
    accent: "water",
    stages: [
      { nationalId: 7, slug: "squirtle", name: "Squirtle", types: ["water"] },
      { nationalId: 8, slug: "wartortle", name: "Wartortle", types: ["water"] },
      { nationalId: 9, slug: "blastoise", name: "Blastoise", types: ["water"] },
    ],
  },
  rare: {
    label: "Rare roll",
    accent: "rare",
    stages: [
      { nationalId: 25, slug: "pikachu", name: "Pikachu", types: ["electric"] },
      { nationalId: 132, slug: "ditto", name: "Ditto", types: ["normal"] },
    ],
  },
};

/** Showdown-animated legendaries with reliable `ani` GIFs. */
export const SCAN_PIPELINE_LEGENDARY_POOL: ScanPipelineSprite[] = [
  { nationalId: 144, slug: "articuno", name: "Articuno", types: ["ice", "flying"] },
  { nationalId: 145, slug: "zapdos", name: "Zapdos", types: ["electric", "flying"] },
  { nationalId: 146, slug: "moltres", name: "Moltres", types: ["fire", "flying"] },
  { nationalId: 150, slug: "mewtwo", name: "Mewtwo", types: ["psychic"] },
  { nationalId: 249, slug: "lugia", name: "Lugia", types: ["psychic", "flying"] },
  { nationalId: 250, slug: "hooh", name: "Ho-Oh", types: ["fire", "flying"] },
  { nationalId: 384, slug: "rayquaza", name: "Rayquaza", types: ["dragon", "flying"] },
  { nationalId: 382, slug: "kyogre", name: "Kyogre", types: ["water"] },
  { nationalId: 383, slug: "groudon", name: "Groudon", types: ["ground"] },
  { nationalId: 483, slug: "dialga", name: "Dialga", types: ["steel", "dragon"] },
  { nationalId: 484, slug: "palkia", name: "Palkia", types: ["water", "dragon"] },
  { nationalId: 487, slug: "giratina", name: "Giratina", types: ["ghost", "dragon"] },
  { nationalId: 643, slug: "reshiram", name: "Reshiram", types: ["dragon", "fire"] },
  { nationalId: 644, slug: "zekrom", name: "Zekrom", types: ["dragon", "electric"] },
  { nationalId: 716, slug: "xerneas", name: "Xerneas", types: ["fairy"] },
  { nationalId: 717, slug: "yveltal", name: "Yveltal", types: ["dark", "flying"] },
  { nationalId: 888, slug: "zacian", name: "Zacian", types: ["fairy"] },
  { nationalId: 1007, slug: "koraidon", name: "Koraidon", types: ["fighting", "dragon"] },
  { nationalId: 1008, slug: "miraidon", name: "Miraidon", types: ["electric", "dragon"] },
];

export type ScanEvolutionStage = 0 | 1 | 2;
export type ScanEvolutionTransition = "to-stage-1" | "to-stage-2" | null;

export type ScanPipelineRun = {
  sessionKey: string;
  lineId: ScanPipelineLineId;
  accent: ScanPipelineAccent;
  lineLabel: string;
  /** Rare path only — Ditto's final transform. */
  legendaryFinal: ScanPipelineSprite | null;
};

const RARE_LINE_CHANCE = 14;

/** Pipeline step index → evolution stage (final forms align with market step). */
const FINAL_STAGE_FROM_STEP: SystemScanStep = "market";
const FINAL_STAGE_FROM_INDEX = SYSTEM_SCAN_STEPS.findIndex((s) => s.step === FINAL_STAGE_FROM_STEP);

function hashSession(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function pickScanPipelineLine(sessionKey: string): ScanPipelineLineId {
  const h = hashSession(sessionKey);
  if (h % 100 < RARE_LINE_CHANCE) return "rare";
  const starters: ScanPipelineLineId[] = ["fire", "grass", "water"];
  return starters[(h >>> 8) % starters.length]!;
}

export function pickLegendaryForRareLine(sessionKey: string): ScanPipelineSprite {
  const h = hashSession(`${sessionKey}:legendary`);
  return SCAN_PIPELINE_LEGENDARY_POOL[h % SCAN_PIPELINE_LEGENDARY_POOL.length]!;
}

export function createScanPipelineRun(sessionKey: string): ScanPipelineRun {
  const lineId = pickScanPipelineLine(sessionKey);
  const line = SCAN_PIPELINE_LINES[lineId];
  return {
    sessionKey,
    lineId,
    accent: line.accent,
    lineLabel: line.label,
    legendaryFinal: lineId === "rare" ? pickLegendaryForRareLine(sessionKey) : null,
  };
}

export function computeScanPipelineProgress(
  steps: SystemChatMessage[],
  options?: { bootstrapping?: boolean },
): number {
  const total = SYSTEM_SCAN_STEPS.length;
  if (!steps.length) {
    return options?.bootstrapping ? 0.05 : 0;
  }
  const doneCount = steps.filter((s) => s.done).length;
  const active = steps.find((s) => s.active);
  const activeIdx = active
    ? SYSTEM_SCAN_STEPS.findIndex((s) => s.step === active.step)
    : Math.min(doneCount, total - 1);
  const progress = active ? (activeIdx + 0.45) / total : doneCount / total;
  return Math.min(0.97, Math.max(0.05, progress));
}

function pipelineStepIndex(
  steps: SystemChatMessage[],
  statusHint?: string | null,
): number | null {
  const hint = statusHint?.toLowerCase() ?? "";
  if (hint.includes("market") || hint.includes("comps")) {
    return FINAL_STAGE_FROM_INDEX >= 0 ? FINAL_STAGE_FROM_INDEX : 4;
  }

  const active = steps.find((s) => s.active);
  if (active) {
    const i = SYSTEM_SCAN_STEPS.findIndex((s) => s.step === active.step);
    return i >= 0 ? i : null;
  }
  const done = steps.filter((s) => s.done).length;
  if (done === 0) return null;
  return Math.min(done, SYSTEM_SCAN_STEPS.length - 1);
}

/** Stage from live pipeline steps — final form when market step starts. */
export function evolutionStageForPipeline(
  steps: SystemChatMessage[],
  options?: { bootstrapping?: boolean; statusHint?: string | null },
): ScanEvolutionStage {
  const idx = pipelineStepIndex(steps, options?.statusHint);
  if (idx === null) return options?.bootstrapping ? 0 : 0;
  if (idx <= 1) return 0;
  if (idx <= 3) return 1;
  return 2;
}

export function evolutionTransitionForPipeline(
  steps: SystemChatMessage[],
  statusHint?: string | null,
): ScanEvolutionTransition | null {
  const active = steps.find((s) => s.active);
  if (active?.step === "match") return "to-stage-1";
  if (active?.step === "market") return "to-stage-2";
  const hint = statusHint?.toLowerCase() ?? "";
  if (hint.includes("market") && !steps.some((s) => s.active && s.step === "market")) {
    return "to-stage-2";
  }
  return null;
}

/** @deprecated Use evolutionStageForPipeline — progress % alone misaligns with market step. */
export function evolutionStageForProgress(progress: number): ScanEvolutionStage {
  void progress;
  return 0;
}

/** @deprecated Use evolutionTransitionForPipeline */
export function evolutionTransitionForProgress(progress: number): ScanEvolutionTransition {
  void progress;
  return null;
}

export function spriteForPipelineRun(
  run: ScanPipelineRun,
  stage: ScanEvolutionStage,
): ScanPipelineSprite {
  if (run.lineId === "rare") {
    if (stage === 0) return SCAN_PIPELINE_LINES.rare.stages[0]!;
    if (stage === 1) return SCAN_PIPELINE_LINES.rare.stages[1]!;
    return run.legendaryFinal ?? SCAN_PIPELINE_LEGENDARY_POOL[0]!;
  }
  const line = SCAN_PIPELINE_LINES[run.lineId];
  return line.stages[Math.min(stage, line.stages.length - 1)]!;
}

export function pipelinePhaseLabel(
  run: ScanPipelineRun,
  stage: ScanEvolutionStage,
  transition: ScanEvolutionTransition,
  sprite: ScanPipelineSprite,
): string {
  if (transition === "to-stage-1") {
    return run.lineId === "rare" ? "Pikachu is morphing into Ditto…" : `${sprite.name} is evolving…`;
  }
  if (transition === "to-stage-2") {
    if (run.lineId === "rare" && run.legendaryFinal) {
      return `Ditto transforms into ${run.legendaryFinal.name}…`;
    }
    const finalName =
      run.lineId === "fire"
        ? "Charizard"
        : run.lineId === "grass"
          ? "Venusaur"
          : run.lineId === "water"
            ? "Blastoise"
            : sprite.name;
    return `Final evolution — ${finalName}`;
  }
  if (stage === 0) return `${sprite.name} · scanning your cards`;
  if (stage === 1) return `${sprite.name} · matching catalog`;
  if (run.lineId === "rare" && run.legendaryFinal) {
    return `${run.legendaryFinal.name} · syncing market comps`;
  }
  const finalName =
    run.lineId === "fire"
      ? "Charizard"
      : run.lineId === "grass"
        ? "Venusaur"
        : run.lineId === "water"
          ? "Blastoise"
          : sprite.name;
  return `${finalName} · syncing market comps`;
}

export function activePipelineStepLabel(steps: SystemChatMessage[]): string | null {
  const active = steps.find((s) => s.active);
  if (active?.label?.trim()) return active.label.trim();
  const lastDone = [...steps].reverse().find((s) => s.done);
  return lastDone?.label?.trim() ?? null;
}

export function spritesToPreloadForRun(run: ScanPipelineRun): ScanPipelineSprite[] {
  const line = SCAN_PIPELINE_LINES[run.lineId];
  const out = [...line.stages];
  if (run.legendaryFinal) out.push(run.legendaryFinal);
  const seen = new Set<string>();
  return out.filter((s) => {
    if (seen.has(s.slug)) return false;
    seen.add(s.slug);
    return true;
  });
}
