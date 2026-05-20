"use client";

import { useEffect, useState } from "react";

/**
 * Reads `--spark-primary` / `--spark-secondary` from the active `data-theme`
 * so WebGL sparkles stay in sync with CSS palettes.
 */
export function useSparkThemeColors() {
  const [primary, setPrimary] = useState("#2dd4bf");
  const [secondary, setSecondary] = useState("#818cf8");
  const [tertiary, setTertiary] = useState("#38bdf8");

  useEffect(() => {
    const root = document.documentElement;

    const read = () => {
      const cs = getComputedStyle(root);
      const p = cs.getPropertyValue("--spark-primary").trim();
      const s = cs.getPropertyValue("--spark-secondary").trim();
      const t = cs.getPropertyValue("--spark-tertiary").trim();
      if (p) setPrimary(p);
      if (s) setSecondary(s);
      if (t) setTertiary(t);
    };

    read();
    const mo = new MutationObserver(read);
    mo.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    window.addEventListener("pgt-theme-change", read);
    return () => {
      mo.disconnect();
      window.removeEventListener("pgt-theme-change", read);
    };
  }, []);

  return { primary, secondary, tertiary };
}
