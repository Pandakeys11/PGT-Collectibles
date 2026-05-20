import "server-only";

import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import { planLimitsFor, type UserPlan } from "@/lib/auth/plans";

export type UsageSnapshot = {
  dailyUsed: number;
  monthlyUsed: number;
  dailyLimit: number | null;
  monthlyLimit: number | null;
  remainingToday: number | null;
  remainingMonth: number | null;
  bonusScans: number;
};

export type ConsumeCreditsResult = {
  allowed: boolean;
  reason: string;
  dailyUsed: number;
  monthlyUsed: number;
  dailyLimit: number | null;
  monthlyLimit: number | null;
  bonusScans: number;
};

function todayKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function monthKey(now = new Date()) {
  return `${now.toISOString().slice(0, 7)}-01`;
}

function isMissingBonusColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message ?? "").toLowerCase();
  return error.code === "42703" || msg.includes("bonus_scans") || msg.includes("column");
}

export function emptyUsageForPlan(plan: UserPlan): UsageSnapshot {
  const limits = planLimitsFor(plan);
  return {
    dailyUsed: 0,
    monthlyUsed: 0,
    dailyLimit: limits.dailyScans,
    monthlyLimit: limits.monthlyScans,
    remainingToday: limits.dailyScans == null ? null : limits.dailyScans,
    remainingMonth: limits.monthlyScans,
    bonusScans: 0,
  };
}

async function getBonusScans(userId: string): Promise<number> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("app_users")
    .select("bonus_scans")
    .eq("id", userId)
    .maybeSingle();
  if (isMissingBonusColumn(error)) return 0;
  if (error) throw error;
  return Number((data as { bonus_scans?: number } | null)?.bonus_scans ?? 0);
}

export async function getUsageSnapshot(
  userId: string,
  plan: UserPlan,
  options?: { unlimited?: boolean },
): Promise<UsageSnapshot> {
  const limits = planLimitsFor(plan);
  const unlimited = options?.unlimited === true;
  if (!isSupabaseConfigured()) {
    return emptyUsageForPlan(plan);
  }

  const supabase = getSupabaseAdmin();
  const [counterResult, bonusScans] = await Promise.all([
    supabase
      .from("usage_counters")
      .select("daily_used, monthly_used")
      .eq("user_id", userId)
      .eq("day_key", todayKey())
      .eq("month_key", monthKey())
      .maybeSingle(),
    getBonusScans(userId).catch(() => 0),
  ]);

  if (counterResult.error) throw counterResult.error;

  const dailyUsed = Number((counterResult.data as { daily_used?: number } | null)?.daily_used ?? 0);
  const monthlyUsed = Number((counterResult.data as { monthly_used?: number } | null)?.monthly_used ?? 0);

  return {
    dailyUsed,
    monthlyUsed,
    dailyLimit: unlimited ? null : limits.dailyScans,
    monthlyLimit: unlimited ? null : limits.monthlyScans,
    remainingToday: unlimited ? null : limits.dailyScans == null ? null : Math.max(0, limits.dailyScans - dailyUsed),
    remainingMonth: unlimited ? null : limits.monthlyScans == null ? null : Math.max(0, limits.monthlyScans - monthlyUsed),
    bonusScans,
  };
}

export async function consumeScanCredits({
  userId,
  credits,
  route,
  metadata,
}: {
  userId: string;
  credits: number;
  route: string;
  metadata?: Record<string, unknown>;
}): Promise<ConsumeCreditsResult> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is required before scans can be metered.");
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("consume_scan_credits", {
    p_app_user_id: userId,
    p_credits: credits,
    p_route: route,
    p_metadata: metadata ?? {},
  });

  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    allowed: Boolean(row?.allowed),
    reason: String(row?.reason ?? "unknown"),
    dailyUsed: Number(row?.daily_used ?? 0),
    monthlyUsed: Number(row?.monthly_used ?? 0),
    dailyLimit: row?.daily_limit == null ? null : Number(row.daily_limit),
    monthlyLimit: row?.monthly_limit == null ? null : Number(row.monthly_limit),
    bonusScans: Number(row?.bonus_scans ?? 0),
  };
}
