"use client";

import { Palette } from "lucide-react";
import { ThemeSwatchOrb } from "@/components/shell/theme-swatch";
import { useActiveTheme } from "@/lib/apply-theme";
import { THEME_ENERGY_MAP, themeEnergyLabel } from "@/lib/energy-theme";
import { nextThemeId, THEMES } from "@/lib/themes";
import { cn } from "@/lib/cn";

export function ThemeCyclePill({
  className,
  showLabel = true,
  size = "md",
}: {
  className?: string;
  showLabel?: boolean;
  size?: "sm" | "md";
}) {
  const { themeId, label, cycleTheme } = useActiveTheme();
  const nextId = nextThemeId(themeId);
  const nextLabel = THEMES.find((t) => t.id === nextId)?.label ?? "next";
  const energy = themeEnergyLabel(themeId);
  const nextEnergy = themeEnergyLabel(nextId);
  const { primary } = THEME_ENERGY_MAP[themeId];

  return (
    <button
      type="button"
      onClick={() => cycleTheme()}
      className={cn(
        "group inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-black/30 text-left transition touch-manipulation",
        "hover:border-accent/35 hover:bg-panel-raised/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        size === "sm" ? "px-2 py-1.5" : "px-2.5 py-2",
        className,
      )}
      style={{
        boxShadow: `0 0 16px -6px rgb(var(--energy-${primary}-glow) / 0.5), inset 0 1px 0 rgb(255 255 255 / 0.06)`,
      }}
      title={`${label} (${energy}). Tap for ${nextLabel} (${nextEnergy}).`}
      aria-label={`Cycle color theme. Current ${label}, ${energy}. Next ${nextLabel}, ${nextEnergy}.`}
    >
      <ThemeSwatchOrb themeId={themeId} className={size === "sm" ? "h-7 w-7" : "h-8 w-8"} />
      {showLabel ? (
        <span className="min-w-0 hidden sm:block">
          <span className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-muted">
            <Palette className="h-3 w-3 text-accent" aria-hidden />
            Theme
          </span>
          <span className="block truncate text-[11px] font-medium text-primary">{label}</span>
          <span className="block truncate text-[9px] text-muted">{energy}</span>
        </span>
      ) : null}
    </button>
  );
}
