"use client";

import { X } from "lucide-react";
import { LiquidAskMarkdown } from "./liquid-ask-markdown";
import { cn } from "@/lib/cn";

export function DigitalScanHowToPanel({
  markdown,
  onDismiss,
  className,
}: {
  markdown: string;
  onDismiss?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative rounded-xl border border-violet-500/25 bg-violet-500/[0.07] px-3 py-2.5 ring-1 ring-violet-400/15 sm:px-4 sm:py-3",
        className,
      )}
    >
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="absolute right-2 top-2 rounded-md p-1 text-slate-500 hover:bg-white/5 hover:text-slate-300"
          aria-label="Dismiss Digital Scan tips"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
      <LiquidAskMarkdown text={markdown} className="text-xs sm:text-sm" />
    </div>
  );
}
