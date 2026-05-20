import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isMasterAdminEmail } from "@/lib/auth/admin";
import { syncCurrentAppUser } from "@/lib/auth/app-user";
import { planLimitsFor } from "@/lib/auth/plans";
import { getUsageSnapshot } from "@/lib/auth/usage";
import { BILLING_PRODUCTS, isBillingConfigured } from "@/lib/billing/pricing";
import { getEarlyPromoStats } from "@/lib/auth/promo-stats";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

export async function GET() {
  await auth.protect();

  const appUser = await syncCurrentAppUser();
  if (!appUser) {
    return NextResponse.json({
      databaseConfigured: false,
      billingConfigured: isBillingConfigured(),
      user: null,
      usage: null,
      products: BILLING_PRODUCTS,
    });
  }

  const isMasterAdmin = isMasterAdminEmail(appUser.email);
  const usage = await getUsageSnapshot(appUser.id, appUser.plan, { unlimited: isMasterAdmin });
  const earlyPromo = await getEarlyPromoStats();
  return NextResponse.json({
    databaseConfigured: isSupabaseConfigured(),
    billingConfigured: isBillingConfigured(),
    isMasterAdmin,
    user: appUser,
    planLimits: planLimitsFor(isMasterAdmin ? "admin" : appUser.plan),
    usage: { ...usage, bonusScans: appUser.bonusScans },
    earlyPromo,
    products: BILLING_PRODUCTS,
  });
}
