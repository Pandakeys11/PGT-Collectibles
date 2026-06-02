"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BINDER_THEME_ORDER,
  DEFAULT_BINDER_THEME,
  type BinderThemeId,
} from "@/lib/catalog/binder-theme";

const STORAGE_KEY = "pgt.binder.theme.v1";

function readStoredTheme(): BinderThemeId {
  if (typeof window === "undefined") return DEFAULT_BINDER_THEME;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_BINDER_THEME;
    if (BINDER_THEME_ORDER.includes(raw as BinderThemeId)) return raw as BinderThemeId;
  } catch {
    /* ignore */
  }
  return DEFAULT_BINDER_THEME;
}

export function useBinderTheme() {
  const [theme, setThemeState] = useState<BinderThemeId>(DEFAULT_BINDER_THEME);

  useEffect(() => {
    setThemeState(readStoredTheme());
  }, []);

  const setTheme = useCallback((next: BinderThemeId) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  return { theme, setTheme };
}
