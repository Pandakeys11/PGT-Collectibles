"use client";

import Link from "next/link";
import { Sparkles, Zap } from "lucide-react";
import { cn } from "@/lib/cn";
import type { AccountQuota } from "@/hooks/use-scan-quota";
import { isProTierPlan } from "@/lib/auth/plans";

function pct(used: number, limit: number | null) {
  if (limit == null || limit === 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

export function ScanQuotaChip({
  quota,
  compact,
  className,
}: {
  quota: AccountQuota | null;
  compact?: boolean;
  className?: string;
}) {
  if (!quota) return null;

  const { usage, plan, isMasterAdmin } = quota;
  const isAdmin = Boolean(isMasterAdmin) || plan === "admin";
  const isPro = isProTierPlan(plan);

  if (isAdmin) {
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
  const dailyPct = pct(usage.dailyUsed, usage.dailyLimit);
  const monthPct = pct(usage.monthlyUsed, usage.monthlyLimit);
  const warn = dailyPct >= 80 || monthPct >= 80;
  const critical =
    (usage.remainingToday != null && usage.remainingToday <= 0 && usage.bonusScans <= 0) ||
    (usage.remainingMonth != null && usage.remainingMonth <= 0 && usage.bonusScans <= 0);

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
        critical
          ? "border-rose-400/40 bg-rose-500/10 text-rose-100 hover:border-rose-300/60"
          : warn
            ? "border-amber-400/35 bg-amber-500/10 text-amber-100 hover:border-amber-300/50"
            : "border-cyan-300/25 bg-cyan-300/8 text-cyan-100 hover:border-cyan-200/45 hover:bg-cyan-300/12",
        className,
      )}
      title="View scan usage and upgrade options"
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
