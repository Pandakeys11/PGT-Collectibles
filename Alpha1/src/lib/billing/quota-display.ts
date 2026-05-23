import type { UsageSnapshot } from "@/lib/auth/usage";

export type QuotaDisplayParts = {
  primary: string;
  secondary: string | null;
  dailyPct: number;
  monthPct: number;
  warn: boolean;
  critical: boolean;
};

export function quotaUsagePercents(usage: UsageSnapshot) {
  const dailyPct =
    usage.dailyLimit != null && usage.dailyLimit > 0
      ? Math.min(100, Math.round((usage.dailyUsed / usage.dailyLimit) * 100))
      : 0;
  const monthPct =
    usage.monthlyLimit != null && usage.monthlyLimit > 0
      ? Math.min(100, Math.round((usage.monthlyUsed / usage.monthlyLimit) * 100))
      : 0;
  return { dailyPct, monthPct };
}

export function buildQuotaDisplayParts(usage: UsageSnapshot): QuotaDisplayParts {
  const { dailyPct, monthPct } = quotaUsagePercents(usage);
  const warn = dailyPct >= 80 || monthPct >= 80;
  const critical =
    (usage.remainingToday != null && usage.remainingToday <= 0 && usage.bonusScans <= 0) ||
    (usage.remainingMonth != null && usage.remainingMonth <= 0 && usage.bonusScans <= 0);

  let primary: string;
  let secondary: string | null = null;

  if (usage.dailyLimit != null) {
    primary = `${usage.remainingToday ?? 0} of ${usage.dailyLimit} scans left today`;
    if (usage.monthlyLimit != null) {
      secondary = `${usage.remainingMonth ?? 0} of ${usage.monthlyLimit} this month`;
    }
  } else if (usage.monthlyLimit != null) {
    primary = `${usage.remainingMonth ?? 0} of ${usage.monthlyLimit} scans left this month`;
  } else {
    primary = "Unlimited scans";
  }

  return { primary, secondary, dailyPct, monthPct, warn, critical };
}
