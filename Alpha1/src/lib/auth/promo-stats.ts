import "server-only";

import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import { EARLY_USER_PROMO, earlyPromoSlotsRemaining } from "@/lib/auth/promotions";

export type EarlyPromoStats = {
  signupLimit: number;
  bonusScans: number;
  slotsClaimed: number;
  slotsRemaining: number;
  promoActive: boolean;
};

export async function getEarlyPromoStats(): Promise<EarlyPromoStats | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = getSupabaseAdmin();
  const { count, error } = await supabase
    .from("app_users")
    .select("id", { count: "exact", head: true })
    .not("early_promo_number", "is", null);

  if (error) {
    if (error.code === "42703" || (error.message ?? "").includes("early_promo_number")) {
      return null;
    }
    throw error;
  }

  const slotsClaimed = count ?? 0;
  const slotsRemaining = earlyPromoSlotsRemaining(slotsClaimed);

  return {
    signupLimit: EARLY_USER_PROMO.signupLimit,
    bonusScans: EARLY_USER_PROMO.bonusScans,
    slotsClaimed,
    slotsRemaining,
    promoActive: slotsRemaining > 0,
  };
}
