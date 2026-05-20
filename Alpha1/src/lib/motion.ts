/** Shared motion tokens — keep durations/easing consistent app-wide. */
export const MOTION_EASE = [0.22, 1, 0.36, 1] as const;

export const MOTION_SPRING = { type: "spring" as const, stiffness: 380, damping: 32 };

export const MOTION_DURATION = {
  fast: 0.22,
  base: 0.38,
  slow: 0.5,
} as const;

export const MOTION_OFFSET = {
  enterY: 10,
  exitY: -6,
} as const;
