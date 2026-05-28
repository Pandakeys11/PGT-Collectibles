"use client";

import { useMemo } from "react";
import { ENERGY_UI } from "@/lib/energy-ui";
import { THEME_ENERGY_MAP } from "@/lib/energy-theme";
import type { EnergyType } from "@/lib/energy-theme";
import { DEFAULT_THEME_ID, type ThemeId } from "@/lib/themes";

export function useActiveThemeEnergy(): {
  themeId: ThemeId;
  primary: EnergyType;
  secondary: EnergyType;
  ui: (typeof ENERGY_UI)[EnergyType];
} {
  const themeId = DEFAULT_THEME_ID;
  const { primary, secondary } = THEME_ENERGY_MAP[themeId];
  const ui = useMemo(() => ENERGY_UI[primary], [primary]);
  return { themeId, primary, secondary, ui };
}
