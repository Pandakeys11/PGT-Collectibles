"use client";

import { useState } from "react";
import { Calculator, ChevronDown } from "lucide-react";
import { CollectorVendorCalculator } from "@/components/scanner-chat/collector-vendor-calculator";
import { cn } from "@/lib/cn";

/** Compact collapsible deal calculator for the market intelligence rail. */
export function CollectorCalculatorCollapsible({
  baseAmount = 0,
  cardCount = 0,
  baseLabel = "Session FMV",
  defaultOpen = false,
  className,
}: {
  baseAmount?: number;
  cardCount?: number;
  baseLabel?: string;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={cn("rounded-lg border border-white/8 bg-white/[0.02]", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left touch-manipulation"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <Calculator className="h-3.5 w-3.5 text-emerald-400/90" />
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Deal calculator
          </span>
          {baseAmount > 0 ? (
            <span className="font-mono text-[10px] tabular-nums text-slate-500">
              ${baseAmount.toLocaleString()} FMV
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-slate-500 transition", open && "rotate-180")}
        />
      </button>
      {open ? (
        <div className="border-t border-white/6 px-1.5 pb-1.5 pt-0">
          <CollectorVendorCalculator
            baseAmount={baseAmount}
            cardCount={cardCount}
            baseLabel={baseLabel}
            compact
            rail
          />
        </div>
      ) : null}
    </div>
  );
}
