"use client";

import { useId } from "react";
import { EnergySymbol } from "@/components/shell/energy-symbol";
import { ENERGY_LABELS, THEME_ENERGY_MAP } from "@/lib/energy-theme";
import type { ThemeId } from "@/lib/themes";
import { cn } from "@/lib/cn";

/** Pokémon league gym badge — brushed metal, enamel energies, no neon glow. */
export function EnergyThemePickerCard({
  themeId,
  label,
  active,
  compact,
  onSelect,
}: {
  themeId: ThemeId;
  label: string;
  active: boolean;
  compact?: boolean;
  onSelect: () => void;
}) {
  const uid = useId().replace(/:/g, "");
  const { primary, secondary } = THEME_ENERGY_MAP[themeId];
  const dual = primary !== secondary;
  const badgeSize = compact ? 46 : 54;
  const primarySize = compact ? "sm" : "md";
  const secondarySize = "xs";

  const ariaEnergy = dual
    ? `${ENERGY_LABELS[primary]} and ${ENERGY_LABELS[secondary]}`
    : ENERGY_LABELS[primary];

  return (
    <button
      type="button"
      onClick={onSelect}
      title={`${label} — ${ariaEnergy}`}
      aria-label={`${label}, ${ariaEnergy}${active ? ", selected" : ""}`}
      aria-pressed={active}
      className={cn(
        "group flex w-full flex-col items-center gap-1 border-0 bg-transparent p-0 transition touch-manipulation",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-1",
        "hover:opacity-95",
      )}
    >
      <span
        className={cn(
          "relative inline-flex items-center justify-center rounded-full",
          active && "ring-[1.5px] ring-[#b8a066] ring-offset-2 ring-offset-transparent",
        )}
        style={{ width: badgeSize, height: badgeSize }}
      >
        <svg
          viewBox="0 0 64 64"
          className="h-full w-full"
          style={{ filter: "drop-shadow(0 2px 3px rgb(0 0 0 / 0.35))" }}
          aria-hidden
        >
          <defs>
            <linearGradient id={`brass-${uid}`} x1="12" y1="10" x2="52" y2="54">
              <stop offset="0%" stopColor="#e8e4dc" />
              <stop offset="35%" stopColor="#b8b0a4" />
              <stop offset="65%" stopColor="#8a8378" />
              <stop offset="100%" stopColor="#6a645c" />
            </linearGradient>
            <linearGradient id={`brass-edge-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f5f2ec" />
              <stop offset="100%" stopColor="#5a554e" />
            </linearGradient>
            <radialGradient id={`field-${uid}`} cx="32" cy="29" r="20">
              <stop offset="0%" stopColor="#3d4654" />
              <stop offset="85%" stopColor="#1e2430" />
              <stop offset="100%" stopColor="#141820" />
            </radialGradient>
            <radialGradient id={`field-shine-${uid}`} cx="28" cy="24" r="14">
              <stop offset="0%" stopColor="rgb(255 255 255 / 0.12)" />
              <stop offset="100%" stopColor="rgb(255 255 255 / 0)" />
            </radialGradient>
            <linearGradient id={`ribbon-${uid}`} x1="26" y1="46" x2="38" y2="54">
              <stop offset="0%" stopColor="#a39a8c" />
              <stop offset="100%" stopColor="#6e6860" />
            </linearGradient>
          </defs>

          {/* Outer league medal */}
          <circle cx="32" cy="30" r="28" fill={`url(#brass-${uid})`} />
          <circle
            cx="32"
            cy="30"
            r="28"
            fill="none"
            stroke={`url(#brass-edge-${uid})`}
            strokeWidth="1.2"
          />
          <circle cx="32" cy="30" r="28" fill="none" stroke="rgb(0 0 0 / 0.25)" strokeWidth="0.5" />

          {/* Recessed enamel field */}
          <circle cx="32" cy="30" r="20.5" fill={`url(#field-${uid})`} />
          <circle cx="32" cy="30" r="20.5" fill="none" stroke="rgb(0 0 0 / 0.5)" strokeWidth="1" />
          <circle cx="32" cy="30" r="20.5" fill={`url(#field-shine-${uid})`} />
          <circle
            cx="32"
            cy="30"
            r="20.5"
            fill="none"
            stroke="rgb(255 255 255 / 0.08)"
            strokeWidth="0.6"
          />

          {/* Ribbon clasp */}
          <path
            d="M25.5 46.5 H38.5 L36 50.5 H28 Z"
            fill={`url(#ribbon-${uid})`}
            stroke="rgb(0 0 0 / 0.35)"
            strokeWidth="0.4"
            strokeLinejoin="round"
          />
        </svg>

        {/* Primary — center enamel emblem */}
        <span className="absolute inset-0 flex items-center justify-center pb-1.5">
          <EnergySymbol energy={primary} size={primarySize} appearance="badge" />
        </span>

        {/* Secondary — small inset plate */}
        {dual ? (
          <span className="absolute bottom-[18%] right-[11%] flex items-center justify-center rounded-[5px] border border-[#5a554e]/80 bg-[#252a34] p-[1.5px] shadow-[inset_0_1px_2px_rgb(0_0_0/0.5)]">
            <EnergySymbol energy={secondary} size={secondarySize} appearance="badge" />
          </span>
        ) : null}
      </span>

      {!compact ? (
        <span
          className={cn(
            "max-w-full truncate text-center text-[8px] font-medium leading-tight",
            active ? "text-primary" : "text-muted group-hover:text-primary/90",
          )}
        >
          {label.split(" ")[0]}
        </span>
      ) : null}
    </button>
  );
}
