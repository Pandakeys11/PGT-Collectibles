"use client";

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";
import { MOTION_DURATION, MOTION_EASE } from "@/lib/motion";

export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={{ duration: MOTION_DURATION.base, ease: MOTION_EASE }}>
      {children}
    </MotionConfig>
  );
}
