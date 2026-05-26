import "server-only";

import { auth, currentUser } from "@clerk/nextjs/server";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import { isUserPlan, type UserPlan } from "@/lib/auth/plans";

export type AppUser = {
  id: string;
  clerkUserId: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  plan: UserPlan;
  betaNumber: number | null;
  earlyPromoNumber: number | null;
  bonusScans: number;
  createdAt: string;
  lastActiveAt: string | null;
};

type AppUserRow = {
  id: string;
  clerk_user_id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  plan: string;
  beta_number: number | null;
  early_promo_number?: number | null;
  bonus_scans?: number | null;
  created_at: string;
  last_active_at: string | null;
};

const APP_USER_COLUMNS =
  "id, clerk_user_id, email, display_name, avatar_url, plan, beta_number, early_promo_number, bonus_scans, created_at, last_active_at";

const APP_USER_COLUMNS_LEGACY =
  "id, clerk_user_id, email, display_name, avatar_url, plan, beta_number, bonus_scans, created_at, last_active_at";

function isMissingBonusColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message ?? "").toLowerCase();
  return error.code === "42703" || msg.includes("bonus_scans") || msg.includes("early_promo_number") || msg.includes("column");
}

function mapAppUser(row: AppUserRow): AppUser {
  return {
    id: row.id,
    clerkUserId: row.clerk_user_id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    plan: isUserPlan(row.plan) ? row.plan : "trial",
    betaNumber: row.beta_number,
    earlyPromoNumber: row.early_promo_number ?? null,
    bonusScans: Number(row.bonus_scans ?? 0),
    createdAt: row.created_at,
    lastActiveAt: row.last_active_at,
  };
}

async function clerkIdentity() {
  try {
    const user = await currentUser();
    if (!user) return { email: null, displayName: null, avatarUrl: null };
    const email =
      user.emailAddresses.find((item) => item.id === user.primaryEmailAddressId)?.emailAddress ??
      user.emailAddresses[0]?.emailAddress ??
      null;
    const displayName =
      [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.username || null;
    return { email, displayName, avatarUrl: user.imageUrl ?? null };
  } catch {
    // Clerk can transiently return 500 for `currentUser()` during incident/quota events.
    // Scan/extraction routes should be able to proceed without hard-failing the whole request.
    return { email: null, displayName: null, avatarUrl: null };
  }
}

export async function syncCurrentAppUser(): Promise<AppUser | null> {
  const { userId } = await auth();
  if (!userId || !isSupabaseConfigured()) return null;

  const identity = await clerkIdentity();
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc("sync_clerk_user", {
      p_clerk_user_id: userId,
      p_email: identity.email,
      p_display_name: identity.displayName,
      p_avatar_url: identity.avatarUrl,
    });

    if (error || !data) return null;
    return mapAppUser(data as AppUserRow);
  } catch {
    return null;
  }
}

export async function getCurrentAppUser(): Promise<AppUser | null> {
  const { userId } = await auth();
  if (!userId || !isSupabaseConfigured()) return null;

  const supabase = getSupabaseAdmin();
  let { data, error } = await supabase
    .from("app_users")
    .select(APP_USER_COLUMNS)
    .eq("clerk_user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (isMissingBonusColumn(error)) {
    const legacy = await supabase
      .from("app_users")
      .select(APP_USER_COLUMNS_LEGACY)
      .eq("clerk_user_id", userId)
      .is("deleted_at", null)
      .maybeSingle();
    data = legacy.data ? { ...legacy.data, early_promo_number: null, bonus_scans: 0 } : null;
    error = legacy.error;
  }

  if (error) throw error;
  if (!data) return syncCurrentAppUser();

  return mapAppUser(data as AppUserRow);
}
