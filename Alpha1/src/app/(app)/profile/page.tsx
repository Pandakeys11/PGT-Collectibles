import { auth } from "@clerk/nextjs/server";
import { UserProfile } from "@clerk/nextjs";
import Link from "next/link";
import { AccountStatusCard } from "@/components/account/account-status-card";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { isMasterAdminEmail } from "@/lib/auth/admin";
import { syncCurrentAppUser } from "@/lib/auth/app-user";
import { emptyUsageForPlan, getUsageSnapshot } from "@/lib/auth/usage";
import { isSupabaseConfigured } from "@/lib/supabase/admin";
import { planLimitsFor } from "@/lib/auth/plans";

export const metadata = {
  title: "Profile",
};

export default async function ProfilePage() {
  await auth.protect();
  const appUser = await syncCurrentAppUser();
  const plan = appUser?.plan ?? "trial";
  const usage = appUser
    ? await getUsageSnapshot(appUser.id, plan).catch(() => ({
        ...emptyUsageForPlan(plan),
        bonusScans: appUser.bonusScans,
      }))
    : emptyUsageForPlan(plan);

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-5">
      <AccountStatusCard
        plan={plan}
        betaNumber={appUser?.betaNumber ?? null}
        earlyPromoNumber={appUser?.earlyPromoNumber ?? null}
        usage={{ ...usage, bonusScans: appUser?.bonusScans ?? usage.bonusScans }}
        databaseConfigured={isSupabaseConfigured()}
        masterAdminPreview={isMasterAdminEmail(appUser?.email ?? null)}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="desk-surface-raised overflow-hidden p-2">
          <UserProfile
            routing="hash"
            appearance={{
              elements: {
                rootBox: "w-full",
                cardBox: "w-full shadow-none",
              },
            }}
          />
        </Card>
        <Card className="desk-surface-raised p-5">
          <p className="text-desk-label">Account</p>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-muted">Email</dt>
              <dd className="mt-1 break-words text-primary">
                {appUser?.email ?? "Pending Clerk sync"}
              </dd>
            </div>
            <div>
              <dt className="text-muted">App user id</dt>
              <dd className="mt-1 break-all font-mono text-xs text-primary">{appUser?.id ?? "Pending Supabase sync"}</dd>
            </div>
            <div>
              <dt className="text-muted">Plan</dt>
              <dd className="mt-1 text-primary">{planLimitsFor(plan).label}</dd>
            </div>
          </dl>
          <Button variant="secondary" size="sm" className="mt-4 w-full" asChild>
            <Link href="/usage">Usage & plans</Link>
          </Button>
        </Card>
      </div>
    </div>
  );
}
