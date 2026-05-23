"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { readResponseJson } from "@/lib/http/read-response-json";
import type { UserPlan } from "@/lib/auth/plans";
import type { PlanLimits } from "@/lib/auth/plans";
import type { UsageSnapshot } from "@/lib/auth/usage";
import { isProTierPlan } from "@/lib/auth/plans";

export type AccountQuota = {
  plan: UserPlan;
  planLimits: PlanLimits;
  usage: UsageSnapshot;
  databaseConfigured: boolean;
  isMasterAdmin?: boolean;
};

let accountMeInflight: Promise<void> | null = null;

export function useScanQuota() {
  const { isSignedIn } = useAuth();
  const [quota, setQuota] = useState<AccountQuota | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!isSignedIn) {
      setQuota(null);
      return;
    }
    if (accountMeInflight) {
      await accountMeInflight;
      return;
    }
    setLoading(true);
    accountMeInflight = (async () => {
    try {
      const res = await fetch("/api/account/me", { cache: "no-store" });
      const data = await readResponseJson<{
        user?: { plan: UserPlan; bonusScans?: number } | null;
        usage?: UsageSnapshot | null;
        planLimits?: PlanLimits;
        databaseConfigured?: boolean;
        isMasterAdmin?: boolean;
      }>(res);
      if (!res.ok || !data.user || !data.usage || !data.planLimits) {
        setQuota(null);
        return;
      }
      setQuota({
        plan: data.user.plan,
        planLimits: data.planLimits,
        usage: {
          ...data.usage,
          bonusScans: data.usage.bonusScans ?? data.user.bonusScans ?? 0,
        },
        databaseConfigured: Boolean(data.databaseConfigured),
        isMasterAdmin: Boolean(data.isMasterAdmin),
      });
    } catch {
      setQuota(null);
    } finally {
      setLoading(false);
      accountMeInflight = null;
    }
    })();
    await accountMeInflight;
  }, [isSignedIn]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!isSignedIn) return;
    const id = window.setInterval(() => void refresh(), 90_000);
    return () => window.clearInterval(id);
  }, [isSignedIn, refresh]);

  const isPro = quota ? isProTierPlan(quota.plan) : false;
  const isAdmin = Boolean(quota?.isMasterAdmin) || quota?.plan === "admin";
  const atDailyLimit =
    !isAdmin &&
    quota?.usage.remainingToday != null &&
    quota.usage.remainingToday <= 0 &&
    quota.usage.bonusScans <= 0;
  const atMonthlyLimit =
    !isAdmin &&
    quota?.usage.remainingMonth != null &&
    quota.usage.remainingMonth <= 0 &&
    quota.usage.bonusScans <= 0;
  const lowToday =
    quota?.usage.remainingToday != null &&
    quota.usage.dailyLimit != null &&
    quota.usage.remainingToday <= Math.max(2, Math.ceil(quota.usage.dailyLimit * 0.2));

  return {
    quota,
    loading,
    refresh,
    isPro,
    atDailyLimit,
    atMonthlyLimit,
    lowToday,
  };
}
