/**
 * Energy Nexus — types and semantic mappings for UI states.
 */

import type { ThemeId } from "@/lib/themes";

export const ENERGY_TYPES = [
  "fire",
  "water",
  "electric",
  "grass",
  "psychic",
  "dark",
  "metal",
  "fighting",
  "fairy",
  "dragon",
] as const;

export type EnergyType = (typeof ENERGY_TYPES)[number];

export const ENERGY_LABELS: Record<EnergyType, string> = {
  fire: "Fire",
  water: "Water",
  electric: "Electric",
  grass: "Grass",
  psychic: "Psychic",
  dark: "Dark",
  metal: "Metal",
  fighting: "Fighting",
  fairy: "Fairy",
  dragon: "Dragon",
};

/** CSS custom property prefix, e.g. `--energy-fire-1` */
export function energyVar(energy: EnergyType, stop: 1 | 2 | 3 | "glow" = 1): string {
  const suffix = stop === "glow" ? "glow" : String(stop);
  return `--energy-${energy}-${suffix}`;
}

/** Tailwind utility stem: `text-energy-fire-1`, `bg-energy-electric-2/15`, etc. */
export function energyToneClass(
  energy: EnergyType,
  stop: 1 | 2 | 3 = 1,
  kind: "text" | "bg" | "ring" | "border" = "text",
): string {
  return `${kind}-energy-${energy}-${stop}`;
}

/** Map 0–1 confidence to energy accent (doc: grass verified → electric high → fighting mid → fire low). */
export function confidenceToEnergy(score: number): EnergyType {
  if (score >= 0.95) return "grass";
  if (score >= 0.85) return "electric";
  if (score >= 0.7) return "fighting";
  return "fire";
}

export type VerificationUiStatus = "verified" | "partial" | "failed";

export function verificationToEnergy(status: VerificationUiStatus): EnergyType {
  if (status === "verified") return "grass";
  if (status === "partial") return "fighting";
  return "fire";
}

export function verificationToBadgeTone(
  status: VerificationUiStatus,
): "success" | "warning" | "danger" {
  if (status === "verified") return "success";
  if (status === "partial") return "warning";
  return "danger";
}

export const THEME_ENERGY_MAP: Record<ThemeId, { primary: EnergyType; secondary: EnergyType }> = {
  "obsidian-clean": { primary: "metal", secondary: "electric" },
};

export function themeEnergyLabel(id: ThemeId): string {
  const { primary, secondary } = THEME_ENERGY_MAP[id];
  if (primary === secondary) return ENERGY_LABELS[primary];
  return `${ENERGY_LABELS[primary]} · ${ENERGY_LABELS[secondary]}`;
}
