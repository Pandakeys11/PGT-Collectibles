import { Gift } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EARLY_USER_PROMO, hasEarlyUserPromo } from "@/lib/auth/promotions";
import type { EarlyPromoStats } from "@/lib/auth/promo-stats";

export function EarlyPromoBanner({
  earlyPromoNumber,
  promoStats,
}: {
  earlyPromoNumber: number | null;
  promoStats: EarlyPromoStats | null;
}) {
  if (hasEarlyUserPromo(earlyPromoNumber)) {
    return (
      <Card className="desk-surface-raised border-violet-400/30 bg-violet-500/10 p-4">
        <div className="flex items-start gap-3">
          <Gift className="mt-0.5 h-5 w-5 shrink-0 text-violet-200" />
          <div>
            <p className="text-desk-label">{EARLY_USER_PROMO.label} perk active</p>
            <p className="mt-1 text-sm text-primary">
              You&apos;re early adopter #{earlyPromoNumber} —{" "}
              <span className="font-semibold text-violet-100">
                +{EARLY_USER_PROMO.bonusScans} starter scans
              </span>{" "}
              were added to your bonus balance at signup.
            </p>
            <p className="mt-1 text-xs text-muted">
              Bonus scans never expire and apply after your monthly free allowance is used.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (!promoStats?.promoActive) return null;

  return (
    <Card className="desk-surface-raised border-cyan-400/25 bg-cyan-500/10 p-4">
      <div className="flex items-start gap-3">
        <Gift className="mt-0.5 h-5 w-5 shrink-0 text-cyan-200" />
        <div>
          <p className="text-desk-label">Limited launch perk</p>
          <p className="mt-1 text-sm text-primary">
            The first {promoStats.signupLimit} accounts get{" "}
            <span className="font-semibold text-cyan-100">+{promoStats.bonusScans} bonus scans</span>{" "}
            automatically at signup — on top of the free monthly allowance.
          </p>
          <p className="mt-1 text-xs text-muted">
            {promoStats.slotsRemaining.toLocaleString()} of {promoStats.signupLimit.toLocaleString()} spots left ·
            allocated in signup order when you create your account
          </p>
        </div>
      </div>
    </Card>
  );
}
