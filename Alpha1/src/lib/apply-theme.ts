"use client";

import { useCallback, useLayoutEffect, useState } from "react";
import {
  DEFAULT_THEME_ID,
  isThemeId,
  nextThemeId,
  THEME_STORAGE_KEY,
  THEMES,
  type ThemeId,
} from "@/lib/themes";

export const THEME_CHANGE_EVENT = "pgt-theme-change";

export function applyTheme(id: ThemeId): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", id);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

export function readActiveTheme(): ThemeId {
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

export function themeLabel(id: ThemeId): string {
  return THEMES.find((t) => t.id === id)?.label ?? "Theme";
}

export function useActiveTheme(): {
  themeId: ThemeId;
  label: string;
  setTheme: (id: ThemeId) => void;
  cycleTheme: () => ThemeId;
} {
  const [themeId, setThemeId] = useState<ThemeId>(DEFAULT_THEME_ID);

  useLayoutEffect(() => {
    setThemeId(readActiveTheme());
    const sync = () => setThemeId(readActiveTheme());
    window.addEventListener(THEME_CHANGE_EVENT, sync);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, sync);
  }, []);

  const setTheme = useCallback((id: ThemeId) => {
    applyTheme(id);
    setThemeId(id);
  }, []);

  const cycleTheme = useCallback(() => {
    const next = nextThemeId(readActiveTheme());
    applyTheme(next);
    setThemeId(next);
    return next;
  }, []);

  return {
    themeId,
    label: themeLabel(themeId),
    setTheme,
    cycleTheme,
  };
}
