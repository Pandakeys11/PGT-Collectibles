"use client";

import { useEffect, useState } from "react";

/**
 * Tracks `prefers-reduced-motion`. Defaults to `true` until the client reads
 * `matchMedia` so we do not mount heavy motion/WebGL for reduced-motion users
 * during the first paint.
 */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return reduced;
}
