"use client";

import { useLayoutEffect, useState } from "react";
import { ENERGY_UI, type EnergyUiTokens } from "@/lib/energy-ui";
import { THEME_ENERGY_MAP } from "@/lib/energy-theme";
import type { EnergyType } from "@/lib/energy-theme";
import { THEME_CHANGE_EVENT } from "@/lib/apply-theme";
import { DEFAULT_THEME_ID, isThemeId, THEME_STORAGE_KEY, type ThemeId } from "@/lib/themes";

function readThemeId(): ThemeId {
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

export function useActiveThemeEnergy(): {
  themeId: ThemeId;
  primary: EnergyType;
  secondary: EnergyType;
  ui: EnergyUiTokens;
} {
  const [themeId, setThemeId] = useState<ThemeId>(DEFAULT_THEME_ID);

  useLayoutEffect(() => {
    const sync = () => setThemeId(readThemeId());
    sync();
    window.addEventListener(THEME_CHANGE_EVENT, sync);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, sync);
  }, []);

  const { primary, secondary } = THEME_ENERGY_MAP[themeId];
  return { themeId, primary, secondary, ui: ENERGY_UI[primary] };
}
