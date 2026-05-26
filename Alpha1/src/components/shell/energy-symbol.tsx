"use client";

import type { ComponentType, CSSProperties } from "react";
import { useId } from "react";
import type { EnergyType } from "@/lib/energy-theme";
import { cn } from "@/lib/cn";

/** Flat-top TCG energy hex. */
const ENERGY_HEX =
  "M12 1.65 20.45 6.42v11.16L12 22.35 3.55 17.58V6.42L12 1.65z";

const ENERGY_HEX_INNER =
  "M12 3.35 18.65 7.35v9.3L12 20.65 5.35 16.65v-9.3L12 3.35z";

export type EnergySymbolSize = "xs" | "sm" | "md" | "lg";

const SIZE_CLASS: Record<EnergySymbolSize, string> = {
  xs: "h-3.5 w-3.5 min-h-[14px] min-w-[14px]",
  sm: "h-5 w-5 min-h-[20px] min-w-[20px]",
  md: "h-7 w-7 min-h-[28px] min-w-[28px]",
  lg: "h-9 w-9 min-h-[36px] min-w-[36px]",
};

type SymbolGlyphProps = { ink: string; highlight: string };

function FireGlyph({ ink, highlight }: SymbolGlyphProps) {
  return (
    <>
      <path
        fill={ink}
        stroke="rgb(0 0 0 / 0.28)"
        strokeWidth="0.35"
        strokeLinejoin="round"
        d="M12 5.2c1.35 2.35 2.65 3.75 2.65 6.05a2.65 2.65 0 1 1-5.3 0c0-2.3 1.3-3.7 2.65-6.05zm0 10.35c-1.05 1.25-1.85 2.35-1.85 3.75 0 1.55 1.25 2.75 2.85 2.75s2.85-1.2 2.85-2.75c0-1.4-.8-2.5-1.85-3.75z"
      />
      <path fill={highlight} d="M11.2 7.8c.45 1.1.9 1.85.9 2.85a.9.9 0 1 1-1.8 0c0-1 .45-1.75.9-2.85z" opacity="0.9" />
    </>
  );
}

function WaterGlyph({ ink, highlight }: SymbolGlyphProps) {
  return (
    <>
      <path
        fill={ink}
        stroke="rgb(0 0 0 / 0.25)"
        strokeWidth="0.35"
        d="M12 5.35c3.1 4.15 4.65 6.75 4.65 9.15a4.65 4.65 0 1 1-9.3 0c0-2.4 1.55-5 4.65-9.15z"
      />
      <ellipse fill={highlight} cx="10.4" cy="11.2" rx="1.35" ry="2" opacity="0.85" />
    </>
  );
}

function ElectricGlyph({ ink, highlight }: SymbolGlyphProps) {
  return (
    <>
      <path
        fill={ink}
        stroke="rgb(0 0 0 / 0.32)"
        strokeWidth="0.35"
        strokeLinejoin="round"
        d="M13.55 4.85 9.55 12.15h3.25l-1.75 7.1 6.65-9.35H14.1l1.2-5.05z"
      />
      <path fill={highlight} d="M12.85 7.1 11.2 11.2h1.5l-.65 2.75 2.45-3.45h-1.35l.95-3.62z" opacity="0.92" />
    </>
  );
}

function GrassGlyph({ ink, highlight }: SymbolGlyphProps) {
  return (
    <>
      <path
        fill={ink}
        stroke="rgb(0 0 0 / 0.25)"
        strokeWidth="0.35"
        d="M12 5.65c-3.15 1.35-5.15 3.85-5.4 7-.2 2.45 1.55 4.7 3.75 5.75.45-2.95 1.35-4.95 2.95-6.45 1.6 1.5 2.5 3.5 2.95 6.45 2.2-1.05 3.95-3.3 3.75-5.75-.25-3.15-2.25-5.65-5.4-7z"
      />
      <path fill={highlight} d="M12 7.2c-1.2.55-2 1.45-2.15 2.55-.1.75.45 1.45 1.2 1.65.15-1 .55-1.75 1.2-2.35.65.6 1.05 1.35 1.2 2.35.75-.2 1.3-.9 1.2-1.65-.15-1.1-.95-2-2.15-2.55z" opacity="0.88" />
    </>
  );
}

function PsychicGlyph({ ink, highlight }: SymbolGlyphProps) {
  return (
    <>
      <ellipse
        fill={ink}
        stroke="rgb(0 0 0 / 0.28)"
        strokeWidth="0.35"
        cx="12"
        cy="12.1"
        rx="5.65"
        ry="3.95"
      />
      <ellipse fill={highlight} cx="12" cy="12.1" rx="3.1" ry="2.05" opacity="0.55" />
      <circle fill="rgb(20 8 32)" cx="12" cy="12.1" r="1.75" />
      <circle fill={highlight} cx="12.55" cy="11.55" r="0.55" opacity="0.95" />
    </>
  );
}

function DarkGlyph({ ink, highlight }: SymbolGlyphProps) {
  return (
    <>
      <path
        fill={ink}
        stroke="rgb(0 0 0 / 0.35)"
        strokeWidth="0.35"
        d="M15.35 6.25a6.35 6.35 0 1 0 0 11.5 5.05 5.05 0 1 1 0-11.5z"
      />
      <path fill={highlight} d="M14.2 8.1a4.2 4.2 0 1 0 0 7.8 3.35 3.35 0 1 1 0-7.8z" opacity="0.35" />
    </>
  );
}

function MetalGlyph({ ink, highlight }: SymbolGlyphProps) {
  return (
    <>
      <circle fill={ink} stroke="rgb(0 0 0 / 0.3)" strokeWidth="0.35" cx="12" cy="12" r="4.15" />
      <circle fill="none" stroke={highlight} strokeWidth="1.1" cx="12" cy="12" r="2.35" opacity="0.95" />
      <path
        fill="none"
        d="M12 6.85v1.45M12 15.7v1.45M7.15 12h1.45M15.7 12h1.45M8.75 8.75l1.02 1.02M14.23 14.23l1.02 1.02M15.25 8.75l-1.02 1.02M8.77 14.23l-1.02 1.02"
        stroke={highlight}
        strokeWidth="1.15"
        strokeLinecap="round"
      />
    </>
  );
}

function FightingGlyph({ ink, highlight }: SymbolGlyphProps) {
  return (
    <>
      <path
        fill={ink}
        stroke="rgb(0 0 0 / 0.28)"
        strokeWidth="0.35"
        strokeLinejoin="round"
        d="M8.85 8.05c.95-1.4 2.85-1.85 4.25-.95l1.3.95 1.65-1.3c1.15-.95 2.85-.6 3.55.85.6 1.3-.15 2.85-1.45 3.45l-1.75.85.35 2.45c.25 1.55-.95 2.85-2.45 2.85h-3.35c-1.45 0-2.6-1.15-2.45-2.55l.35-2.7-1.65-.95c-1.15-.7-1.65-2.2-.75-3.2z"
      />
      <path fill={highlight} d="M11.2 10.2h1.6v2.35h-1.6z" opacity="0.75" />
    </>
  );
}

function FairyGlyph({ ink, highlight }: SymbolGlyphProps) {
  return (
    <>
      <path
        fill={ink}
        stroke="rgb(0 0 0 / 0.22)"
        strokeWidth="0.35"
        strokeLinejoin="round"
        d="M12 5.75 13.75 10.15h4.15l-3.35 2.45 1.25 4.05L12 15.35 8.2 16.65l1.25-4.05-3.35-2.45h4.15L12 5.75z"
      />
      <circle fill={highlight} cx="12" cy="11.35" r="1.35" opacity="0.9" />
    </>
  );
}

function DragonGlyph({ ink, highlight }: SymbolGlyphProps) {
  return (
    <>
      <path fill={ink} stroke="rgb(0 0 0 / 0.3)" strokeWidth="0.35" d="M6.65 9.35h10.7v1.75H6.65zm0 3.55h10.7v1.75H6.65z" />
      <path
        fill={highlight}
        stroke="rgb(0 0 0 / 0.22)"
        strokeWidth="0.3"
        d="M8.85 6.85 12 4.55l3.15 2.3v10.3L12 19.45l-3.15-2.45V6.85z"
        opacity="0.92"
      />
    </>
  );
}

const GLYPHS: Record<EnergyType, ComponentType<SymbolGlyphProps>> = {
  fire: FireGlyph,
  water: WaterGlyph,
  electric: ElectricGlyph,
  grass: GrassGlyph,
  psychic: PsychicGlyph,
  dark: DarkGlyph,
  metal: MetalGlyph,
  fighting: FightingGlyph,
  fairy: FairyGlyph,
  dragon: DragonGlyph,
};

function glyphInk(energy: EnergyType): { ink: string; highlight: string } {
  if (energy === "dark") {
    return {
      ink: "rgb(var(--energy-dark-3))",
      highlight: "rgb(var(--energy-dark-2))",
    };
  }
  if (energy === "psychic") {
    return {
      ink: "rgb(var(--energy-psychic-3))",
      highlight: "rgb(255 255 255)",
    };
  }
  return {
    ink: "rgb(255 252 245)",
    highlight: `rgb(var(--energy-${energy}-3))`,
  };
}

export function EnergySymbol({
  energy,
  className,
  title,
  size = "md",
  /** Flat enamel look for gym badges — no neon glow. */
  appearance = "default",
}: {
  energy: EnergyType;
  className?: string;
  title?: string;
  size?: EnergySymbolSize;
  appearance?: "default" | "badge";
}) {
  const uid = useId().replace(/:/g, "");
  const gradId = `${uid}-${energy}-body`;
  const shineId = `${uid}-${energy}-shine`;
  const Glyph = GLYPHS[energy];
  const isDragon = energy === "dragon";
  const { ink, highlight } = glyphInk(energy);

  const glowStyle: CSSProperties =
    appearance === "badge"
      ? { filter: "drop-shadow(0 1px 1px rgb(0 0 0 / 0.4))" }
      : {
          filter: [
            `drop-shadow(0 1px 0 rgb(0 0 0 / 0.45))`,
            `drop-shadow(0 0 8px rgb(var(--energy-${energy}-glow) / 0.75))`,
          ].join(" "),
        };

  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className={cn("aspect-square shrink-0", SIZE_CLASS[size], className)}
      style={glowStyle}
    >
      <defs>
        <linearGradient id={gradId} x1="12" y1="1.5" x2="12" y2="22.5" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={`rgb(var(--energy-${energy}-3))`} />
          <stop offset="32%" stopColor={`rgb(var(--energy-${energy}-2))`} />
          <stop offset="100%" stopColor={`rgb(var(--energy-${energy}-1))`} />
        </linearGradient>
        <radialGradient id={shineId} cx="35%" cy="28%" r="58%">
          <stop offset="0%" stopColor="rgb(255 255 255 / 0.55)" />
          <stop offset="55%" stopColor="rgb(255 255 255 / 0.08)" />
          <stop offset="100%" stopColor="rgb(255 255 255 / 0)" />
        </radialGradient>
        {isDragon ? (
          <linearGradient id={`${uid}-dragon-prism`} x1="3" y1="3" x2="21" y2="21">
            <stop offset="0%" stopColor="rgb(var(--energy-dragon-1))" />
            <stop offset="35%" stopColor="rgb(var(--energy-dragon-3))" />
            <stop offset="68%" stopColor="rgb(var(--energy-dragon-2))" />
            <stop offset="100%" stopColor="rgb(var(--energy-dragon-4))" />
          </linearGradient>
        ) : null}
      </defs>

      {/* Drop shadow plate */}
      <path
        d={ENERGY_HEX}
        fill="rgb(0 0 0 / 0.45)"
        transform="translate(0 0.55)"
        opacity="0.55"
      />

      {/* Body */}
      <path
        d={ENERGY_HEX}
        fill={isDragon ? `url(#${uid}-dragon-prism)` : `url(#${gradId})`}
        stroke={`rgb(var(--energy-${energy}-1))`}
        strokeWidth="0.85"
        strokeLinejoin="round"
      />

      {/* Inner bevel */}
      <path
        d={ENERGY_HEX_INNER}
        fill={`url(#${shineId})`}
        opacity="0.9"
        pointerEvents="none"
      />

      {/* Type icon */}
      <g transform="translate(12 12) scale(0.88) translate(-12 -12)">
        <Glyph ink={ink} highlight={highlight} />
      </g>

      {/* Rim highlights */}
      <path
        d={ENERGY_HEX}
        fill="none"
        stroke="rgb(255 255 255 / 0.42)"
        strokeWidth="0.55"
        strokeLinejoin="round"
        pointerEvents="none"
      />
      <path
        d={ENERGY_HEX}
        fill="none"
        stroke="rgb(0 0 0 / 0.22)"
        strokeWidth="0.35"
        strokeLinejoin="round"
        transform="translate(0 0.15)"
        pointerEvents="none"
      />
    </svg>
  );
}
