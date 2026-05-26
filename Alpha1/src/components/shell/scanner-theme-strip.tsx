"use client";

import { EnergyThemePickerCard } from "@/components/shell/energy-theme-picker-card";
import { applyTheme, useActiveTheme } from "@/lib/apply-theme";
import { themeEnergyLabel } from "@/lib/energy-theme";
import { THEMES, type ThemeId } from "@/lib/themes";
import { cn } from "@/lib/cn";

/** Six presets — unique primary energy on each badge (no duplicate Electric, etc.). */
const FEATURED_THEME_IDS: ThemeId[] = [
  "energy-nexus",
  "emerald-vault",
  "coral-depth",
  "midnight-mirage",
  "obsidian-clean",
  "rainbow-chase",
];

/** Compact theme picker — gym trainer badges with theme-colored energy glow. */
export function ScannerThemeStrip({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { themeId, label, cycleTheme } = useActiveTheme();
  const featured = THEMES.filter((t) => FEATURED_THEME_IDS.includes(t.id));

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Color theme</p>
        <button
          type="button"
          onClick={() => cycleTheme()}
          className="shrink-0 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-medium text-accent transition hover:bg-white/[0.08] touch-manipulation"
        >
          Cycle all
        </button>
      </div>
      {!compact ? (
        <div className="min-w-0 px-1">
          <p className="truncate text-[11px] font-medium text-primary">{label}</p>
          <p className="truncate text-[10px] text-faint">{themeEnergyLabel(themeId)}</p>
        </div>
      ) : null}
      <div className="grid grid-cols-3 gap-2">
        {featured.map((theme) => (
          <EnergyThemePickerCard
            key={theme.id}
            themeId={theme.id}
            label={theme.label}
            active={theme.id === themeId}
            compact={compact}
            onSelect={() => applyTheme(theme.id)}
          />
        ))}
      </div>
      {!compact ? (
        <p className="px-1 text-[10px] leading-relaxed text-faint">
          League-style badges — center and corner show each theme&apos;s energy pair.
        </p>
      ) : null}
    </div>
  );
}
