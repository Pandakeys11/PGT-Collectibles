"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "pgt-liquid-scan-rails";

type RailLayoutPrefs = {
  navCollapsed: boolean;
  intelCollapsed: boolean;
};

function readPrefs(): RailLayoutPrefs {
  if (typeof window === "undefined") {
    return { navCollapsed: false, intelCollapsed: false };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { navCollapsed: false, intelCollapsed: false };
    const parsed = JSON.parse(raw) as Partial<RailLayoutPrefs>;
    return {
      navCollapsed: Boolean(parsed.navCollapsed),
      intelCollapsed: Boolean(parsed.intelCollapsed),
    };
  } catch {
    return { navCollapsed: false, intelCollapsed: false };
  }
}

/** Persisted collapse state for Liquid Scan nav + market intelligence rails (desktop). */
export function useLiquidScanRailLayout() {
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [intelCollapsed, setIntelCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const prefs = readPrefs();
    setNavCollapsed(prefs.navCollapsed);
    setIntelCollapsed(prefs.intelCollapsed);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ navCollapsed, intelCollapsed } satisfies RailLayoutPrefs),
      );
    } catch {
      /* private mode */
    }
  }, [navCollapsed, intelCollapsed, hydrated]);

  const toggleNav = useCallback(() => setNavCollapsed((v) => !v), []);
  const toggleIntel = useCallback(() => setIntelCollapsed((v) => !v), []);

  return {
    navCollapsed: hydrated ? navCollapsed : false,
    intelCollapsed: hydrated ? intelCollapsed : false,
    toggleNav,
    toggleIntel,
    setNavCollapsed,
    setIntelCollapsed,
  };
}
