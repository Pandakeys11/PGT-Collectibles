"use client";

import { cn } from "@/lib/cn";
import { BINDER_COLS, BINDER_ROWS } from "@/lib/catalog/binder-layout";

export function CatalogBinderPage({
  side,
  label,
  rangeLabel,
  children,
  className,
  compactHeader = false,
}: {
  side: "left" | "right" | "single";
  label: string;
  rangeLabel?: string;
  children: React.ReactNode;
  className?: string;
  /** Hide page chrome to maximize pocket grid (embedded master catalog). */
  compactHeader?: boolean;
}) {
  return (
    <div
      className={cn(
        "sc-binder-page",
        side === "left" && "sc-binder-page--left",
        side === "right" && "sc-binder-page--right",
        compactHeader && "sc-binder-page--compact",
        className,
      )}
      aria-label={label}
    >
      <div className="sc-binder-page__header">
        <span>{label}</span>
        {rangeLabel ? <span className="tabular-nums opacity-80">{rangeLabel}</span> : null}
      </div>
      <div className="sc-binder-page__body">
        <div
          className="sc-binder-grid"
          style={
            {
              "--binder-cols": BINDER_COLS,
              "--binder-rows": BINDER_ROWS,
            } as React.CSSProperties
          }
        >
          {children}
        </div>
      </div>
      <div className="sc-binder-zip" aria-hidden />
    </div>
  );
}
