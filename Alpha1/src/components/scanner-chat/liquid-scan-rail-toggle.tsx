"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Icon button for collapsing / expanding Liquid Scan side rails. */
export function LiquidScanRailToggle({
  label,
  onClick,
  children,
  className,
  edge = "inline",
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  /** `inline` in panel header; `strip` in collapsed rail column. */
  edge?: "inline" | "strip";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-white/8 hover:text-primary touch-manipulation",
        edge === "strip"
          ? "h-9 w-9 border border-white/8 bg-black/30"
          : "h-8 w-8",
        className,
      )}
    >
      {children}
    </button>
  );
}
