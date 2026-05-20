"use client";

import { useCallback, useLayoutEffect, useState } from "react";
import { ThemeSwatchOrb, ThemeSwatchStrip } from "@/components/shell/theme-swatch";
import { Button } from "@/components/ui/button";
import { ENERGY_LABELS, THEME_ENERGY_MAP } from "@/lib/energy-theme";
import {
  DEFAULT_THEME_ID,
  isThemeId,
  nextThemeId,
  THEME_STORAGE_KEY,
  THEMES,
  type ThemeId,
} from "@/lib/themes";

function themeEnergyLabel(id: ThemeId): string {
  const { primary, secondary } = THEME_ENERGY_MAP[id];
  if (primary === secondary) return ENERGY_LABELS[primary];
  return `${ENERGY_LABELS[primary]} + ${ENERGY_LABELS[secondary]}`;
}

function applyTheme(id: ThemeId) {
  document.documentElement.setAttribute("data-theme", id);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch {
    /* private mode etc. */
  }
  window.dispatchEvent(new Event("pgt-theme-change"));
}

function readInitialTheme(): ThemeId {
  if (typeof window === "undefined") return DEFAULT_THEME_ID;
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored && isThemeId(stored)) return stored;
  } catch {
    /* ignore */
  }
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr && isThemeId(attr)) return attr;
  return DEFAULT_THEME_ID;
}

export function ThemeControl() {
  const [themeId, setThemeId] = useState<ThemeId>(DEFAULT_THEME_ID);

  useLayoutEffect(() => {
    setThemeId(readInitialTheme());
    const sync = () => setThemeId(readInitialTheme());
    window.addEventListener("pgt-theme-change", sync);
    return () => window.removeEventListener("pgt-theme-change", sync);
  }, []);

  const cycle = useCallback(() => {
    const next = nextThemeId(themeId);
    applyTheme(next);
    setThemeId(next);
  }, [themeId]);

  const label = THEMES.find((t) => t.id === themeId)?.label ?? "Theme";
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
      className="h-auto min-h-10 shrink-0 flex-col gap-1 rounded-xl border-white/15 bg-black/35 px-1.5 py-1 sm:min-h-9"
      style={{
        boxShadow: `0 0 18px -6px rgb(var(--energy-${primary}-glow) / 0.55), inset 0 1px 0 rgb(255 255 255 / 0.08)`,
      }}
      onClick={cycle}
      title={`${label} (${energy}). Click for ${nextLabel} (${nextEnergy}).`}
      aria-label={`Cycle color theme. Current ${label}, ${energy}. Next ${nextLabel}, ${nextEnergy}.`}
    >
      <ThemeSwatchOrb themeId={themeId} className="h-8 w-8 sm:h-7 sm:w-7" />
      <ThemeSwatchStrip themeId={themeId} size="sm" className="w-[2.15rem] ring-1 sm:w-8" />
    </Button>
  );
}
