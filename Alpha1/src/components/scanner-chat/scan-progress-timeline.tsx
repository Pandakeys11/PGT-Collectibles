"use client";

import { motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import type { SystemChatMessage } from "@/lib/scanner-chat/types";
import { cn } from "@/lib/cn";

export function ScanProgressTimeline({
  steps,
  className,
}: {
  steps: SystemChatMessage[];
  className?: string;
}) {
  if (!steps.length) return null;

  return (
    <div className={cn("rounded-2xl border border-white/6 sc-glass-raised p-4", className)}>
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        Scan pipeline
      </p>
      <ul className="space-y-2.5">
        {steps.map((step, i) => (
          <motion.li
            key={step.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            className="flex items-center gap-3"
          >
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                step.active
                  ? "border-emerald-400/40 bg-emerald-500/15 sc-timeline-pulse"
                  : step.done
                    ? "border-emerald-500/30 bg-emerald-500/20"
                    : "border-white/10 bg-white/5",
              )}
            >
              {step.active ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
              ) : step.done ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-slate-600" />
              )}
            </span>
            <span
              className={cn(
                "text-sm",
                step.active ? "text-emerald-100" : step.done ? "text-slate-300" : "text-slate-600",
              )}
            >
              {step.label}
            </span>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
