"use client";

import { AlertTriangle, Sparkles } from "lucide-react";
import { SLABZ_RIP_DEMO_MODE, SLABZ_RIP_PARTNERSHIP } from "@/lib/partners/slabz-rip-preview";
import { cn } from "@/lib/cn";

export function SlabzRipDemoBanner({ compact, className }: { compact?: boolean; className?: string }) {
  if (!SLABZ_RIP_DEMO_MODE) return null;

  return (
    <div
      className={cn(
        "sc-slabz-demo-banner rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/[0.1] via-amber-950/20 to-transparent",
        compact ? "px-2.5 py-2" : "px-3 py-2.5",
        className,
      )}
      role="status"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-200/95">
            <span>{SLABZ_RIP_PARTNERSHIP.demoLabel} mode</span>
            <span className="font-normal text-amber-300/50">·</span>
            <span className="inline-flex items-center gap-1 font-semibold normal-case tracking-normal text-amber-100/90">
              <Sparkles className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
              {SLABZ_RIP_PARTNERSHIP.liveLabel}
            </span>
          </p>
          {!compact ? (
            <>
              <p className="mt-1 text-[10px] leading-relaxed text-amber-100/75">
                {SLABZ_RIP_PARTNERSHIP.demoWarning}
              </p>
              <p className="mt-1.5 text-[9px] font-medium uppercase tracking-wider text-slate-500">
                {SLABZ_RIP_PARTNERSHIP.collaboration}
              </p>
            </>
          ) : (
            <p className="mt-0.5 text-[9px] leading-snug text-amber-100/70">
              {SLABZ_RIP_PARTNERSHIP.demoShort}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
