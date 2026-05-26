"use client";

import { ThemeSwatchOrb, ThemeSwatchStrip } from "@/components/shell/theme-swatch";
import { Button } from "@/components/ui/button";
import { THEME_ENERGY_MAP, themeEnergyLabel } from "@/lib/energy-theme";
import { useActiveTheme } from "@/lib/apply-theme";
import { nextThemeId, THEMES, type ThemeId } from "@/lib/themes";

export function ThemeControl() {
  const { themeId, label, cycleTheme } = useActiveTheme();
  const nextId = nextThemeId(themeId);
  const nextLabel = THEMES.find((t) => t.id === nextId)?.label ?? "next";
  const energy = themeEnergyLabel(themeId);
  const nextEnergy = themeEnergyLabel(nextId);
  const { primary } = THEME_ENERGY_MAP[themeId];

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      className="h-auto min-h-10 shrink-0 gap-2 rounded-xl border-white/15 bg-black/35 px-2 py-1 sm:min-h-9"
      style={{
        boxShadow: `0 0 18px -6px rgb(var(--energy-${primary}-glow) / 0.55), inset 0 1px 0 rgb(255 255 255 / 0.08)`,
      }}
      onClick={() => cycleTheme()}
      title={`${label} (${energy}). Click for ${nextLabel} (${nextEnergy}).`}
      aria-label={`Cycle color theme. Current ${label}, ${energy}. Next ${nextLabel}, ${nextEnergy}.`}
    >
      <ThemeSwatchOrb themeId={themeId} className="h-8 w-8 sm:h-7 sm:w-7" />
      <span className="hidden min-w-0 flex-col items-start leading-tight lg:flex">
        <span className="max-w-[5.5rem] truncate text-[10px] font-semibold text-primary">{label}</span>
        <span className="max-w-[5.5rem] truncate text-[9px] text-muted">{energy}</span>
      </span>
      <ThemeSwatchStrip themeId={themeId} size="sm" className="w-[2.15rem] ring-1 sm:w-8 lg:hidden" />
    </Button>
  );
}
