/**
 * Pokémon energy palettes — Tailwind class bundles for desk / neo UI.
 * Colors resolve from `energy-tokens.css` via `energy-*` utilities.
 */

import type { EnergyType } from "@/lib/energy-theme";
import { ENERGY_LABELS } from "@/lib/energy-theme";

export type EnergyUiTokens = {
  label: string;
  /** Primary label / icon */
  text: string;
  textSoft: string;
  ring: string;
  card: string;
  pillar: string;
  navActive: string;
  glow: string;
};

export const ENERGY_UI: Record<EnergyType, EnergyUiTokens> = {
  fire: {
    label: ENERGY_LABELS.fire,
    text: "text-energy-fire-1",
    textSoft: "text-energy-fire-3",
    ring: "border-energy-fire-1/40 bg-energy-fire-1/10",
    card: "border-energy-fire-1/35 bg-gradient-to-b from-energy-fire-1/18 via-energy-fire-2/8 to-[#070b10]",
    pillar:
      "bg-[radial-gradient(ellipse_80%_120%_at_50%_0%,rgb(var(--energy-fire-glow)/0.42),transparent_68%)]",
    navActive: "border-energy-fire-1/45 bg-energy-fire-1/12 text-energy-fire-3",
    glow: "shadow-[0_0_28px_-6px_rgb(var(--energy-fire-glow)/0.55)]",
  },
  water: {
    label: ENERGY_LABELS.water,
    text: "text-energy-water-1",
    textSoft: "text-energy-water-3",
    ring: "border-energy-water-1/40 bg-energy-water-1/10",
    card: "border-energy-water-1/35 bg-gradient-to-b from-energy-water-1/20 via-energy-water-2/10 to-[#070b10]",
    pillar:
      "bg-[radial-gradient(ellipse_80%_120%_at_50%_0%,rgb(var(--energy-water-glow)/0.4),transparent_68%)]",
    navActive: "border-energy-water-1/45 bg-energy-water-1/12 text-energy-water-3",
    glow: "shadow-[0_0_28px_-6px_rgb(var(--energy-water-glow)/0.5)]",
  },
  electric: {
    label: ENERGY_LABELS.electric,
    text: "text-energy-electric-1",
    textSoft: "text-energy-electric-3",
    ring: "border-energy-electric-1/45 bg-energy-electric-1/12",
    card: "border-energy-electric-1/40 bg-gradient-to-b from-energy-electric-1/22 via-energy-electric-2/10 to-[#070b10]",
    pillar:
      "bg-[radial-gradient(ellipse_80%_120%_at_50%_0%,rgb(var(--energy-electric-glow)/0.48),transparent_68%)]",
    navActive: "border-energy-electric-1/50 bg-energy-electric-1/14 text-energy-electric-3",
    glow: "shadow-[0_0_32px_-6px_rgb(var(--energy-electric-glow)/0.6)]",
  },
  grass: {
    label: ENERGY_LABELS.grass,
    text: "text-energy-grass-1",
    textSoft: "text-energy-grass-3",
    ring: "border-energy-grass-1/40 bg-energy-grass-1/10",
    card: "border-energy-grass-1/35 bg-gradient-to-b from-energy-grass-1/20 via-energy-grass-2/10 to-[#070b10]",
    pillar:
      "bg-[radial-gradient(ellipse_80%_120%_at_50%_0%,rgb(var(--energy-grass-glow)/0.4),transparent_68%)]",
    navActive: "border-energy-grass-1/45 bg-energy-grass-1/12 text-energy-grass-3",
    glow: "shadow-[0_0_28px_-6px_rgb(var(--energy-grass-glow)/0.5)]",
  },
  psychic: {
    label: ENERGY_LABELS.psychic,
    text: "text-energy-psychic-1",
    textSoft: "text-energy-psychic-3",
    ring: "border-energy-psychic-1/40 bg-energy-psychic-1/10",
    card: "border-energy-psychic-1/35 bg-gradient-to-b from-energy-psychic-1/22 via-energy-psychic-2/10 to-[#070b10]",
    pillar:
      "bg-[radial-gradient(ellipse_80%_120%_at_50%_0%,rgb(var(--energy-psychic-glow)/0.42),transparent_68%)]",
    navActive: "border-energy-psychic-1/45 bg-energy-psychic-1/12 text-energy-psychic-3",
    glow: "shadow-[0_0_28px_-6px_rgb(var(--energy-psychic-glow)/0.5)]",
  },
  dark: {
    label: ENERGY_LABELS.dark,
    text: "text-energy-dark-3",
    textSoft: "text-energy-dark-2",
    ring: "border-energy-dark-3/35 bg-energy-dark-2/20",
    card: "border-energy-dark-3/30 bg-gradient-to-b from-energy-dark-3/25 via-energy-dark-2/12 to-[#070b10]",
    pillar:
      "bg-[radial-gradient(ellipse_80%_120%_at_50%_0%,rgb(var(--energy-dark-glow)/0.38),transparent_68%)]",
    navActive: "border-energy-dark-3/40 bg-energy-dark-2/25 text-energy-dark-3",
    glow: "shadow-[0_0_28px_-6px_rgb(var(--energy-dark-glow)/0.45)]",
  },
  metal: {
    label: ENERGY_LABELS.metal,
    text: "text-energy-metal-2",
    textSoft: "text-energy-metal-3",
    ring: "border-energy-metal-2/40 bg-energy-metal-1/12",
    card: "border-energy-metal-2/35 bg-gradient-to-b from-energy-metal-2/18 via-energy-metal-1/8 to-[#070b10]",
    pillar:
      "bg-[radial-gradient(ellipse_80%_120%_at_50%_0%,rgb(var(--energy-metal-glow)/0.35),transparent_68%)]",
    navActive: "border-energy-metal-2/45 bg-energy-metal-1/14 text-energy-metal-3",
    glow: "shadow-[0_0_24px_-6px_rgb(var(--energy-metal-glow)/0.4)]",
  },
  fighting: {
    label: ENERGY_LABELS.fighting,
    text: "text-energy-fighting-1",
    textSoft: "text-energy-fighting-3",
    ring: "border-energy-fighting-1/40 bg-energy-fighting-1/10",
    card: "border-energy-fighting-1/35 bg-gradient-to-b from-energy-fighting-1/18 via-energy-fighting-2/10 to-[#070b10]",
    pillar:
      "bg-[radial-gradient(ellipse_80%_120%_at_50%_0%,rgb(var(--energy-fighting-glow)/0.38),transparent_68%)]",
    navActive: "border-energy-fighting-1/45 bg-energy-fighting-1/12 text-energy-fighting-3",
    glow: "shadow-[0_0_26px_-6px_rgb(var(--energy-fighting-glow)/0.45)]",
  },
  fairy: {
    label: ENERGY_LABELS.fairy,
    text: "text-energy-fairy-1",
    textSoft: "text-energy-fairy-3",
    ring: "border-energy-fairy-1/40 bg-energy-fairy-1/10",
    card: "border-energy-fairy-1/35 bg-gradient-to-b from-energy-fairy-1/22 via-energy-fairy-2/12 to-[#070b10]",
    pillar:
      "bg-[radial-gradient(ellipse_80%_120%_at_50%_0%,rgb(var(--energy-fairy-glow)/0.4),transparent_68%)]",
    navActive: "border-energy-fairy-1/45 bg-energy-fairy-1/12 text-energy-fairy-3",
    glow: "shadow-[0_0_28px_-6px_rgb(var(--energy-fairy-glow)/0.48)]",
  },
  dragon: {
    label: ENERGY_LABELS.dragon,
    text: "text-energy-dragon-1",
    textSoft: "text-energy-dragon-3",
    ring: "border-energy-dragon-1/40 bg-energy-dragon-2/15",
    card: "border-energy-dragon-1/35 bg-[linear-gradient(165deg,rgb(var(--energy-dragon-1)/0.22)_0%,rgb(var(--energy-dragon-2)/0.14)_42%,rgb(var(--energy-dragon-4)/0.08)_100%)]",
    pillar:
      "bg-[radial-gradient(ellipse_90%_130%_at_50%_-10%,rgb(var(--energy-dragon-glow)/0.45),rgb(var(--energy-dragon-2)/0.12)_45%,transparent_72%)]",
    navActive:
      "border-energy-dragon-1/45 bg-[linear-gradient(135deg,rgb(var(--energy-dragon-1)/0.14),rgb(var(--energy-dragon-2)/0.12))] text-energy-dragon-3",
    glow: "shadow-[0_0_32px_-6px_rgb(var(--energy-dragon-glow)/0.5)]",
  },
};

/** Canonical 8-pillar showcase (matches Energy Studio reference). */
export const ENERGY_SHOWCASE: EnergyType[] = [
  "fire",
  "water",
  "electric",
  "grass",
  "psychic",
  "dark",
  "metal",
  "dragon",
];

export function energyNavClasses(energy: EnergyType, active: boolean): string {
  const ui = ENERGY_UI[energy];
  return active
    ? ui.navActive
    : "border-white/[0.08] bg-white/[0.035] text-slate-400 hover:border-white/16 hover:bg-white/[0.055] hover:text-white";
}
