import { auth } from "@clerk/nextjs/server";
import { AccountStatusCard } from "@/components/account/account-status-card";
import { UpgradePlansPanel } from "@/components/billing/upgrade-plans-panel";
import { Card } from "@/components/ui/card";
import { getCurrentAppUser, syncCurrentAppUser } from "@/lib/auth/app-user";
import { isMasterAdminEmail } from "@/lib/auth/admin";
import { emptyUsageForPlan, getUsageSnapshot } from "@/lib/auth/usage";
import { SCAN_CREDIT_TIPS } from "@/lib/billing/plan-benefits";
import { isBillingConfigured } from "@/lib/billing/pricing";
import { EarlyPromoBanner } from "@/components/billing/early-promo-banner";
import { getEarlyPromoStats } from "@/lib/auth/promo-stats";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

export const metadata = {
  title: "Usage & Plans",
};

type UsagePageProps = {
  searchParams?: Promise<{ checkout?: string; product?: string }>;
};

export default async function UsagePage({ searchParams }: UsagePageProps) {
  await auth.protect();

  const params = (await searchParams) ?? {};
  let appUser = await getCurrentAppUser();
  if (!appUser && isSupabaseConfigured()) {
    appUser = await syncCurrentAppUser();
  }

  const plan = appUser?.plan ?? "trial";
  const isAdmin = isMasterAdminEmail(appUser?.email ?? null) || plan === "admin";

  let usage = emptyUsageForPlan(plan);
  const earlyPromo = isSupabaseConfigured() ? await getEarlyPromoStats() : null;
  if (appUser) {
    try {
      usage = await getUsageSnapshot(appUser.id, plan, { unlimited: isAdmin });
      usage = { ...usage, bonusScans: appUser.bonusScans };
    } catch {
      usage = { ...emptyUsageForPlan(plan), bonusScans: appUser.bonusScans };
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-5 pb-8">
      <AccountStatusCard
        plan={plan}
        betaNumber={appUser?.betaNumber ?? null}
        earlyPromoNumber={appUser?.earlyPromoNumber ?? null}
        usage={usage}
        databaseConfigured={isSupabaseConfigured()}
        masterAdminPreview={isAdmin}
      />

      <EarlyPromoBanner
        earlyPromoNumber={appUser?.earlyPromoNumber ?? null}
        promoStats={earlyPromo}
      />

      <UpgradePlansPanel
        plan={plan}
        bonusScans={usage.bonusScans}
        billingConfigured={isBillingConfigured()}
        checkoutStatus={params.checkout}
        masterAdminPreview={isAdmin}
      />

      <Card className="desk-surface-raised p-5">
        <p className="text-desk-label">How scan credits work</p>
        <ul className="mt-4 grid gap-2 text-sm text-muted sm:grid-cols-2">
          {SCAN_CREDIT_TIPS.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
        {!isBillingConfigured() ? (
          <p className="mt-4 text-xs text-amber-200/90">
            Checkout requires STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in your environment.
          </p>
        ) : null}
      </Card>
    </div>
  );
}
