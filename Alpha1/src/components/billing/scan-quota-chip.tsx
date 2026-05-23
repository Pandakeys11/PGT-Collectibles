"use client";

import Link from "next/link";
import { ChevronRight, Sparkles, Zap } from "lucide-react";
import { cn } from "@/lib/cn";
import type { AccountQuota } from "@/hooks/use-scan-quota";
import { buildQuotaDisplayParts } from "@/lib/billing/quota-display";
import { isProTierPlan } from "@/lib/auth/plans";

function pct(used: number, limit: number | null) {
  if (limit == null || limit === 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

function QuotaMeter({ pctValue, tone }: { pctValue: number; tone: "ok" | "warn" | "critical" }) {
  const bar =
    tone === "critical"
      ? "bg-rose-400"
      : tone === "warn"
        ? "bg-amber-400"
        : "bg-cyan-400";
  return (
    <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
      <div className={cn("h-full rounded-full transition-all", bar)} style={{ width: `${pctValue}%` }} />
    </div>
  );
}

export function ScanQuotaChip({
  quota,
  compact,
  variant = "default",
  className,
}: {
  quota: AccountQuota | null;
  compact?: boolean;
  /** Full-width mobile bar with readable credit copy */
  variant?: "default" | "mobile";
  className?: string;
}) {
  if (!quota) return null;

  const { usage, plan, isMasterAdmin } = quota;
  const isAdmin = Boolean(isMasterAdmin) || plan === "admin";
  const isPro = isProTierPlan(plan);

  if (isAdmin) {
    if (variant === "mobile") {
      return (
        <Link
          href="/usage"
          className={cn(
            "sc-mobile-quota-bar flex w-full items-center justify-between gap-2 border-b border-emerald-500/20 bg-emerald-500/8 px-3 py-2.5 touch-manipulation",
            className,
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-emerald-300" />
            <span className="text-xs font-medium text-emerald-100">Unlimited scan credits</span>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-emerald-300/70" />
        </Link>
      );
    }
    return (
      <Link
        href="/usage"
        className={cn(
          "inline-flex items-center gap-2 rounded-md border border-emerald-400/35 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-100 transition hover:border-emerald-300/50",
          className,
        )}
        title="Master admin — unlimited scans"
      >
        <Sparkles className="h-3.5 w-3.5 shrink-0" />
        <span className="font-mono tabular-nums">Unlimited</span>
      </Link>
    );
  }

  const display = buildQuotaDisplayParts(usage);
  const dailyPct = pct(usage.dailyUsed, usage.dailyLimit);
  const monthPct = pct(usage.monthlyUsed, usage.monthlyLimit);
  const tone = display.critical ? "critical" : display.warn ? "warn" : "ok";

  if (variant === "mobile") {
    return (
      <Link
        href="/usage"
        className={cn(
          "sc-mobile-quota-bar flex w-full flex-col gap-1.5 border-b px-3 py-2.5 touch-manipulation",
          display.critical
            ? "border-rose-500/25 bg-rose-500/10"
            : display.warn
              ? "border-amber-500/20 bg-amber-500/8"
              : "border-white/6 bg-white/[0.03]",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-start gap-2">
            {isPro ? (
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" />
            ) : (
              <Zap className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
            )}
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Scan credits
              </p>
              <p
                className={cn(
                  "text-xs font-medium leading-snug",
                  display.critical
                    ? "text-rose-100"
                    : display.warn
                      ? "text-amber-100"
                      : "text-slate-100",
                )}
              >
                {display.primary}
              </p>
              {display.secondary ? (
                <p className="mt-0.5 text-[11px] text-slate-500">{display.secondary}</p>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {usage.bonusScans > 0 ? (
              <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[10px] font-medium text-emerald-200">
                +{usage.bonusScans} bonus
              </span>
            ) : null}
            <ChevronRight className="h-4 w-4 text-slate-500" />
          </div>
        </div>
        {usage.dailyLimit != null ? (
          <div className="flex items-center gap-2">
            <span className="w-8 shrink-0 text-[9px] text-slate-600">Day</span>
            <QuotaMeter pctValue={dailyPct} tone={tone} />
          </div>
        ) : null}
        {usage.monthlyLimit != null ? (
          <div className="flex items-center gap-2">
            <span className="w-8 shrink-0 text-[9px] text-slate-600">Mo</span>
            <QuotaMeter pctValue={monthPct} tone={tone} />
          </div>
        ) : null}
      </Link>
    );
  }

  const quotaLabel =
    usage.dailyLimit == null && usage.monthlyLimit != null
      ? `${usage.remainingMonth ?? 0}/${usage.monthlyLimit} mo`
      : usage.dailyLimit == null
        ? "∞ today"
        : `${usage.remainingToday ?? 0}/${usage.dailyLimit} today`;

  return (
    <Link
      href="/usage"
      className={cn(
        "group inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs font-medium transition",
        display.critical
          ? "border-rose-400/40 bg-rose-500/10 text-rose-100 hover:border-rose-300/60"
          : display.warn
            ? "border-amber-400/35 bg-amber-500/10 text-amber-100 hover:border-amber-300/50"
            : "border-cyan-300/25 bg-cyan-300/8 text-cyan-100 hover:border-cyan-200/45 hover:bg-cyan-300/12",
        className,
      )}
      title={display.primary}
    >
      {isPro ? (
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-200" />
      ) : (
        <Zap className="h-3.5 w-3.5 shrink-0" />
      )}
      <span className="font-mono tabular-nums">{quotaLabel}</span>
      {!compact && usage.bonusScans > 0 ? (
        <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-emerald-200">
          +{usage.bonusScans} bonus
        </span>
      ) : null}
      {!compact ? (
        <span className="hidden text-[10px] uppercase tracking-wide text-slate-400 sm:inline">Usage</span>
      ) : null}
    </Link>
  );
}
