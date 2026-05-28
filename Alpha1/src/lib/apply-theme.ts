"use client";

import { useCallback, useLayoutEffect, useState } from "react";
import { DEFAULT_THEME_ID, type ThemeId } from "@/lib/themes";

export const THEME_CHANGE_EVENT = "pgt-theme-change";

export function applyTheme(id: ThemeId = DEFAULT_THEME_ID): void {
  if (typeof document === "undefined") return;
  const theme = id === DEFAULT_THEME_ID ? DEFAULT_THEME_ID : DEFAULT_THEME_ID;
  document.documentElement.setAttribute("data-theme", theme);
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

export function readActiveTheme(): ThemeId {
  return DEFAULT_THEME_ID;
}

export function themeLabel(): string {
  return "Obsidian Clean";
}

export function useActiveTheme(): {
  themeId: ThemeId;
  label: string;
  setTheme: (id: ThemeId) => void;
  cycleTheme: () => ThemeId;
} {
  const [themeId] = useState<ThemeId>(DEFAULT_THEME_ID);

  useLayoutEffect(() => {
    applyTheme(DEFAULT_THEME_ID);
  }, []);

  const setTheme = useCallback((_id: ThemeId) => {
    applyTheme(DEFAULT_THEME_ID);
  }, []);

  const cycleTheme = useCallback(() => {
    applyTheme(DEFAULT_THEME_ID);
    return DEFAULT_THEME_ID;
  }, []);

  return {
    themeId,
    label: themeLabel(),
    setTheme,
    cycleTheme,
  };
}
