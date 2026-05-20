import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { BILLING_PRODUCTS, type BillingProductId } from "@/lib/billing/pricing";

export async function grantBillingProduct(appUserId: string, productId: BillingProductId) {
  const product = BILLING_PRODUCTS[productId];
  const supabase = getSupabaseAdmin();

  if (product.scanCredits) {
    const { error } = await supabase.rpc("add_bonus_scans", {
      p_app_user_id: appUserId,
      p_credits: product.scanCredits,
    });
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from("app_users")
    .update({ plan: "pro", updated_at: new Date().toISOString() })
    .eq("id", appUserId);
  if (error) throw error;
}
