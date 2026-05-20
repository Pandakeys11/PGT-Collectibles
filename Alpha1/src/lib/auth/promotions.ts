/** Keep in sync with `sync_clerk_user` early-user promo in Supabase migrations */
export const EARLY_USER_PROMO = {
  id: "early_user_2026",
  label: "Early adopter",
  /** First N accounts to sign up (by signup order) */
  signupLimit: 200,
  /** One-time bonus scans granted at signup */
  bonusScans: 50,
} as const;

export function hasEarlyUserPromo(earlyPromoNumber: number | null | undefined): boolean {
  return earlyPromoNumber != null && earlyPromoNumber > 0;
}

export function earlyPromoSlotsRemaining(claimedCount: number): number {
  return Math.max(0, EARLY_USER_PROMO.signupLimit - claimedCount);
}

export function earlyPromoSlotsClaimed(maxPromoNumber: number | null | undefined): number {
  return Math.max(0, maxPromoNumber ?? 0);
}
