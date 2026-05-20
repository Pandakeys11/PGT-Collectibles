"use client";

import Link from "next/link";
import { AlertCircle, ArrowRight, Package, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { ScanLimitPayload } from "@/lib/scan/scan-limit-error";
import { scanLimitMessage } from "@/lib/scan/scan-limit-error";

export function ScanLimitBanner({
  limit,
  bonusScans = 0,
  className,
  onDismiss,
}: {
  limit: ScanLimitPayload;
  bonusScans?: number;
  className?: string;
  onDismiss?: () => void;
}) {
  const isDaily = limit.reason === "daily_limit";
  const headline = scanLimitMessage(limit);

  return (
    <div
      className={cn(
        "rounded-lg border border-rose-400/30 bg-gradient-to-br from-rose-950/80 via-[#12080c] to-[#070b10] p-4",
        className,
      )}
    >
      <div className="flex gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-rose-100">{headline}</p>
          <p className="mt-1 text-xs leading-relaxed text-rose-100/75">
            {isDaily
              ? "You have used all included scans for today. Bonus packs apply automatically when plan limits are full."
              : "You have used all included scans this month. Grab a scan pack or upgrade to Pro for higher limits and premium vision."}
          </p>
          {limit.monthlyLimit != null || limit.dailyLimit != null ? (
            <p className="mt-2 font-mono text-[11px] text-rose-200/80">
              {limit.dailyLimit != null
                ? `Today ${limit.dailyUsed}/${limit.dailyLimit}`
                : null}
              {limit.dailyLimit != null && limit.monthlyLimit != null ? " · " : null}
              {limit.monthlyLimit != null
                ? `Month ${limit.monthlyUsed}/${limit.monthlyLimit}`
                : null}
              {bonusScans > 0 ? ` · ${bonusScans} bonus left` : null}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="scan" size="sm" asChild>
              <Link href="/usage#upgrade">
                <Sparkles className="h-4 w-4" />
                Upgrade to Pro
              </Link>
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link href="/usage#packs">
                <Package className="h-4 w-4" />
                Buy scans
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/usage">
                View usage
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
            {onDismiss ? (
              <button
                type="button"
                className="ml-auto text-xs text-rose-200/60 hover:text-rose-100"
                onClick={onDismiss}
              >
                Dismiss
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
