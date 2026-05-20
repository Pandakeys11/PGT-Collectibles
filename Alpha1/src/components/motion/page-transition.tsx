"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { MOTION_DURATION, MOTION_EASE, MOTION_OFFSET } from "@/lib/motion";

export function PageTransition({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <div className="min-w-0 max-w-full">{children}</div>;
  }

  return (
    <motion.div
      className="min-w-0 max-w-full"
      initial={{ opacity: 0, y: MOTION_OFFSET.enterY }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: MOTION_OFFSET.exitY }}
      transition={{ duration: MOTION_DURATION.base, ease: MOTION_EASE }}
    >
      {children}
    </motion.div>
  );
}
