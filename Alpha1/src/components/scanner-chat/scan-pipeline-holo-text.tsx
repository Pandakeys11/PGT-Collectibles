"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Fast in-place holographic foil text (rainbow sweep + sparkle layer).
 */
export function ScanPipelineHoloText({
  children,
  className,
  as: Tag = "p",
  fast = true,
}: {
  children: ReactNode;
  className?: string;
  as?: "p" | "span" | "div";
  /** Quicker sweep for live scan status. */
  fast?: boolean;
}) {
  const Cmp = Tag;
  return (
    <Cmp
      className={cn(
        "sc-scan-holo-text relative inline-block max-w-full",
        fast && "sc-scan-holo-text--fast",
        className,
      )}
    >
      <span className="sc-scan-holo-text__sparkle pointer-events-none" aria-hidden />
      <span className="sc-scan-holo-text__glyph relative z-[1]">{children}</span>
    </Cmp>
  );
}
