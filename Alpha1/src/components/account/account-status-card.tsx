import Link from "next/link";
import { BadgeCheck, Database, ShieldCheck, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { planLimitsFor, isProTierPlan, type UserPlan } from "@/lib/auth/plans";
import type { UsageSnapshot } from "@/lib/auth/usage";
import { EARLY_USER_PROMO, hasEarlyUserPromo } from "@/lib/auth/promotions";
import { cn } from "@/lib/cn";

function limitLabel(used: number, limit: number | null) {
  if (limit == null) return `${used.toLocaleString()} / unlimited`;
  return `${used.toLocaleString()} / ${limit.toLocaleString()}`;
}

function remainingLabel(remaining: number | null) {
  if (remaining == null) return "Unlimited";
  return remaining.toLocaleString();
}

export function AccountStatusCard({
  plan,
  betaNumber,
  earlyPromoNumber,
  usage,
  databaseConfigured,
  masterAdminPreview,
}: {
  plan: UserPlan;
  betaNumber: number | null;
  earlyPromoNumber?: number | null;
  usage: UsageSnapshot;
  databaseConfigured: boolean;
  /** Email is master admin — show unlimited note; billing links stay visible for testing */
  masterAdminPreview?: boolean;
}) {
  const limits = planLimitsFor(plan);
  const isAdmin = plan === "admin" || masterAdminPreview;
  const isPro = isProTierPlan(plan);
  const monthlyPct =
    usage.monthlyLimit == null || usage.monthlyLimit === 0
      ? 0
      : Math.min(100, Math.round((usage.monthlyUsed / usage.monthlyLimit) * 100));
  const dailyPct =
    usage.dailyLimit == null || usage.dailyLimit === 0
      ? 0
      : Math.min(100, Math.round((usage.dailyUsed / usage.dailyLimit) * 100));

  return (
    <Card className="desk-surface-raised p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-desk-label">Access</p>
          <h1 className="mt-2 flex items-center gap-2 font-display text-2xl font-semibold text-primary">
            {isPro ? <Sparkles className="h-6 w-6 text-accent" /> : null}
            {limits.label}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {masterAdminPreview
              ? "Master admin — unlimited scans; billing UI below is for testing"
              : hasEarlyUserPromo(earlyPromoNumber)
                ? `Early adopter #${earlyPromoNumber} · +${EARLY_USER_PROMO.bonusScans} starter scans included`
                : betaNumber
                  ? `Beta member #${betaNumber}`
                  : isPro
                    ? "Premium vision and higher scan limits"
                    : "Free tier — 15 scans per month"}
          </p>
        </div>
        <div
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium",
            databaseConfigured
              ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
              : "border-amber-400/30 bg-amber-400/10 text-amber-200",
          )}
        >
          {databaseConfigured ? <ShieldCheck className="h-3.5 w-3.5" /> : <Database className="h-3.5 w-3.5" />}
          {databaseConfigured ? "Database synced" : "Database setup needed"}
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {isAdmin ? (
          <>
            <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-3 sm:col-span-2">
              <p className="text-desk-label">Scans</p>
              <p className="mt-2 text-lg font-semibold text-emerald-200">Unlimited</p>
              <p className="mt-1 text-xs text-muted">Master admin — no daily or monthly caps</p>
            </div>
          </>
        ) : (
          <>
            {usage.dailyLimit != null ? (
              <UsageStat
                label="Today"
                used={usage.dailyUsed}
                limit={usage.dailyLimit}
                remaining={usage.remainingToday}
                pct={dailyPct}
              />
            ) : null}
            <UsageStat
              label="This month"
              used={usage.monthlyUsed}
              limit={usage.monthlyLimit}
              remaining={usage.remainingMonth}
              pct={monthlyPct}
              className={usage.dailyLimit == null ? "sm:col-span-2" : undefined}
            />
          </>
        )}
        <div className="rounded-lg border border-border-subtle/70 bg-panel-raised/40 p-3">
          <p className="text-desk-label">Bonus scans</p>
          <p className="mt-2 text-lg font-semibold text-emerald-200">{usage.bonusScans.toLocaleString()}</p>
          <p className="mt-1 text-xs text-muted">Applied after plan limits are full</p>
        </div>
        <div className="rounded-lg border border-border-subtle/70 bg-panel-raised/40 p-3">
          <p className="text-desk-label">Plan tier</p>
          <p className="mt-2 flex items-center gap-2 text-sm font-medium text-primary">
            <BadgeCheck className="h-4 w-4 text-accent" />
            {limits.tier === "pro" ? "Pro vision stack" : "Free vision stack"}
          </p>
          <p className="mt-1 text-xs text-muted">
            {limits.premiumVision ? "Gemini / OpenAI when enabled" : "Groq + OpenRouter free models"}
          </p>
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-1 flex justify-between text-[10px] uppercase tracking-wide text-muted">
          <span>Monthly usage</span>
          <span>{monthlyPct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-panel-raised">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              monthlyPct >= 90 ? "bg-rose-400" : monthlyPct >= 70 ? "bg-amber-400" : "bg-accent",
            )}
            style={{ width: `${monthlyPct}%` }}
          />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button variant="scan" size="sm" asChild>
          <Link href="/usage#upgrade">{isPro && !masterAdminPreview ? "Manage Pro" : "Upgrade to Pro"}</Link>
        </Button>
        <Button variant="secondary" size="sm" asChild>
          <Link href="/usage#packs">Buy scan packs</Link>
        </Button>
      </div>
    </Card>
  );
}

function UsageStat({
  label,
  used,
  limit,
  remaining,
  pct,
  className,
}: {
  label: string;
  used: number;
  limit: number | null;
  remaining: number | null;
  pct: number;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-border-subtle/70 bg-panel-raised/40 p-3", className)}>
      <p className="text-desk-label">{label}</p>
      <p className="mt-2 text-lg font-semibold text-primary">{limitLabel(used, limit)}</p>
      <p className="mt-1 text-xs text-muted">{remainingLabel(remaining)} scans left</p>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-panel-raised">
        <div
          className={cn(
            "h-full rounded-full",
            pct >= 90 ? "bg-rose-400" : pct >= 70 ? "bg-amber-400" : "bg-accent/80",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
