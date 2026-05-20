/**
 * Scan economics — aligned to approximate provider cost per vision extraction.
 * Free tier: Groq + OpenRouter free models (~$0.002–0.008 / scan).
 * Pro tier: adds Gemini / OpenAI vision (~$0.03–0.07 / scan at volume).
 */

export type BillingProductId =
  | "pro_monthly"
  | "pro_yearly"
  | "scan_pack_starter"
  | "scan_pack_collector"
  | "scan_pack_bulk";

export type BillingProduct = {
  id: BillingProductId;
  label: string;
  description: string;
  priceCents: number;
  /** Display interval; null for one-time packs */
  interval: "month" | "year" | null;
  scanCredits?: number;
  badge?: string;
};

/** Estimated backend cost per scan (USD) — used for margin checks, not shown raw to users */
export const COST_PER_SCAN_USD = {
  free: 0.006,
  pro: 0.045,
} as const;

export const BILLING_PRODUCTS: Record<BillingProductId, BillingProduct> = {
  pro_monthly: {
    id: "pro_monthly",
    label: "Pro Monthly",
    description: "Premium vision stack, higher limits, priority processing",
    priceCents: 499,
    interval: "month",
    badge: "Popular",
  },
  pro_yearly: {
    id: "pro_yearly",
    label: "Pro Yearly",
    description: "Same Pro benefits — billed once per year",
    priceCents: 5000,
    interval: "year",
    badge: "Best value",
  },
  scan_pack_starter: {
    id: "scan_pack_starter",
    label: "50 scans",
    description: "Top up anytime — never expire",
    priceCents: 199,
    interval: null,
    scanCredits: 50,
  },
  scan_pack_collector: {
    id: "scan_pack_collector",
    label: "200 scans",
    description: "Best per-scan value for active collectors",
    priceCents: 599,
    interval: null,
    scanCredits: 200,
    badge: "Value",
  },
  scan_pack_bulk: {
    id: "scan_pack_bulk",
    label: "500 scans",
    description: "Bulk sessions and binder runs",
    priceCents: 1299,
    interval: null,
    scanCredits: 500,
  },
};

export const SCAN_PACK_PRODUCTS = [
  BILLING_PRODUCTS.scan_pack_starter,
  BILLING_PRODUCTS.scan_pack_collector,
  BILLING_PRODUCTS.scan_pack_bulk,
] as const;

export const PRO_PRODUCTS = [BILLING_PRODUCTS.pro_monthly, BILLING_PRODUCTS.pro_yearly] as const;

export function formatPrice(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

/** Annual savings vs twelve monthly payments (USD cents). */
export function proYearlySavingsCents(): number {
  const monthlyAnnual = BILLING_PRODUCTS.pro_monthly.priceCents * 12;
  return Math.max(0, monthlyAnnual - BILLING_PRODUCTS.pro_yearly.priceCents);
}

export function pricePerScan(product: BillingProduct): string | null {
  if (!product.scanCredits) return null;
  const per = product.priceCents / 100 / product.scanCredits;
  return `${formatPrice(Math.round(per * 100))}/scan`;
}

export function isBillingConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}
