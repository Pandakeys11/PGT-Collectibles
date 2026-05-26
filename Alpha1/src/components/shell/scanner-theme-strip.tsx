"use client";

import { ThemeSwatchOrb } from "@/components/shell/theme-swatch";
import { applyTheme, useActiveTheme } from "@/lib/apply-theme";
import { themeEnergyLabel } from "@/lib/energy-theme";
import { THEMES, type ThemeId } from "@/lib/themes";
import { cn } from "@/lib/cn";

const FEATURED_THEME_IDS: ThemeId[] = [
  "obsidian-clean",
  "energy-nexus",
  "neon-district",
  "emerald-vault",
  "rainbow-chase",
  "midnight-mirage",
];

/** Compact theme picker for scanner sidebar — swatches only on desktop. */
export function ScannerThemeStrip({
  className,
  /** Desktop sidebar: icons only, no labels or footer copy. */
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
      <div className="grid grid-cols-3 gap-1.5">
        {featured.map((theme) => {
          const active = theme.id === themeId;
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => applyTheme(theme.id)}
              className={cn(
                "flex flex-col items-center rounded-xl border transition touch-manipulation",
                compact ? "p-1" : "gap-1 p-1.5",
                active
                  ? "border-accent/40 bg-accent/10 ring-1 ring-accent/25"
                  : "border-white/8 bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.06]",
              )}
              title={`${theme.label} — ${theme.hint}`}
              aria-label={`${theme.label}, ${themeEnergyLabel(theme.id)}${active ? ", selected" : ""}`}
            >
              <ThemeSwatchOrb themeId={theme.id} className={compact ? "h-7 w-7" : "h-8 w-8"} />
              {!compact ? (
                <span className="w-full truncate text-center text-[8px] font-medium text-muted">
                  {theme.label.split(" ")[0]}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {!compact ? (
        <p className="px-1 text-[10px] leading-relaxed text-faint">
          Themes update desk, catalog, and Liquid Scan.
        </p>
      ) : null}
    </div>
  );
}
