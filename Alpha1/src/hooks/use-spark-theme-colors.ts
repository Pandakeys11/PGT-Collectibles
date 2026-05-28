"use client";

import { useEffect, useState } from "react";
import { CATALOG_AMBIENT_CHANGE_EVENT } from "@/lib/ui/catalog-ambient-runtime";
import { THEME_CHANGE_EVENT } from "@/lib/apply-theme";

/**
 * Reads `--spark-primary` / `--spark-secondary` from the document root
 * so WebGL sparkles stay in sync with catalog ambient washes.
 */
export function useSparkThemeColors() {
  const [primary, setPrimary] = useState("#8d99ae");
  const [secondary, setSecondary] = useState("#ffe600");
  const [tertiary, setTertiary] = useState("#fff7a8");

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
    mo.observe(root, {
      attributes: true,
      attributeFilter: ["data-theme", "data-catalog-ambient", "style"],
    });
    window.addEventListener(THEME_CHANGE_EVENT, read);
    window.addEventListener(CATALOG_AMBIENT_CHANGE_EVENT, read);
    return () => {
      mo.disconnect();
      window.removeEventListener(THEME_CHANGE_EVENT, read);
      window.removeEventListener(CATALOG_AMBIENT_CHANGE_EVENT, read);
    };
  }, []);

  return { primary, secondary, tertiary };
}
