"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

export const LIQUID_SCAN_PROMPT_CHIPS = [
  "Scan binder page",
  "Live market pulse",
  "Slabz pack rip",
  "PGT Arcade",
  "Vendor calculator",
  "Open master catalog",
  "Open companion",
  "Identify graded cards",
  "Estimate market value",
  "Export to CSV",
] as const;

export type LiquidScanPromptChip = (typeof LIQUID_SCAN_PROMPT_CHIPS)[number];

export function LiquidScanQuickActions({
  onChipClick,
  className,
  compact,
}: {
  onChipClick: (text: string) => void;
  className?: string;
  /** Tighter row when shown above an active chat feed. */
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "sc-quick-actions-wrap",
        compact ? "sc-quick-actions-wrap--compact" : "",
        className,
      )}
    >
      {!compact ? (
        <p className="sc-quick-actions-hint text-pretty text-[11px] leading-relaxed text-slate-500">
          Quick actions — tap to run without retyping
        </p>
      ) : null}
      <div
        className={cn(
          "flex flex-wrap justify-center gap-2",
          compact ? "gap-1.5" : "",
        )}
      >
        {LIQUID_SCAN_PROMPT_CHIPS.map((chip, i) => (
          <motion.button
            key={chip}
            type="button"
            initial={compact ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={compact ? undefined : { delay: 0.04 * i, duration: 0.35 }}
            onClick={() => onChipClick(chip)}
            className="sc-quick-action-chip"
          >
            <span className="sc-quick-action-chip__label">{chip}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
