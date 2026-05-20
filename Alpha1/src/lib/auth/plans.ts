export type UserPlan = "beta_pro" | "pro" | "trial" | "admin" | "suspended";

export type PlanLimits = {
  label: string;
  tier: "free" | "pro";
  dailyScans: number | null;
  monthlyScans: number | null;
  canScan: boolean;
  /** Uses paid LLM/vision providers when server allows */
  premiumVision: boolean;
};

/** Keep in sync with `consume_scan_credits` in Supabase migrations */
export const PLAN_LIMITS: Record<UserPlan, PlanLimits> = {
  admin: {
    label: "Admin",
    tier: "pro",
    dailyScans: null,
    monthlyScans: null,
    canScan: true,
    premiumVision: true,
  },
  pro: {
    label: "Pro",
    tier: "pro",
    dailyScans: 80,
    monthlyScans: 3000,
    canScan: true,
    premiumVision: true,
  },
  beta_pro: {
    label: "Beta Pro",
    tier: "pro",
    dailyScans: 80,
    monthlyScans: 3000,
    canScan: true,
    premiumVision: true,
  },
  trial: {
    label: "Free",
    tier: "free",
    dailyScans: null,
    monthlyScans: 15,
    canScan: true,
    premiumVision: false,
  },
  suspended: {
    label: "Suspended",
    tier: "free",
    dailyScans: 0,
    monthlyScans: 0,
    canScan: false,
    premiumVision: false,
  },
};

export const BETA_PRO_USER_LIMIT = 500;

export function isUserPlan(value: unknown): value is UserPlan {
  return (
    value === "admin" ||
    value === "pro" ||
    value === "beta_pro" ||
    value === "trial" ||
    value === "suspended"
  );
}

export function isProTierPlan(plan: UserPlan): boolean {
  return plan === "pro" || plan === "beta_pro" || plan === "admin";
}

export function planLimitsFor(plan: UserPlan): PlanLimits {
  return PLAN_LIMITS[plan];
}
