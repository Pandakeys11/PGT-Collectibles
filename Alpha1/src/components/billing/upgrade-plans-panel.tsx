"use client";

import { useState, type ReactNode } from "react";
import { Check, Loader2, Package, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  BILLING_PRODUCTS,
  formatPrice,
  pricePerScan,
  proYearlySavingsCents,
  PRO_PRODUCTS,
  SCAN_PACK_PRODUCTS,
  type BillingProductId,
} from "@/lib/billing/pricing";
import { FREE_TIER_FEATURES, PRO_TIER_FEATURES } from "@/lib/billing/plan-benefits";
import { isProTierPlan, type UserPlan } from "@/lib/auth/plans";
import { readResponseJson } from "@/lib/http/read-response-json";

export function UpgradePlansPanel({
  plan,
  bonusScans,
  billingConfigured,
  checkoutStatus,
  masterAdminPreview,
  onPurchaseComplete,
}: {
  plan: UserPlan;
  bonusScans: number;
  billingConfigured?: boolean;
  checkoutStatus?: string;
  /** Master admin: show full billing UI for testing; scans remain unlimited */
  masterAdminPreview?: boolean;
  onPurchaseComplete?: () => void;
}) {
  const isPro = isProTierPlan(plan);
  const yearlySavings = proYearlySavingsCents();
  const [pending, setPending] = useState<BillingProductId | null>(null);
  const [notice, setNotice] = useState<string | null>(
    checkoutStatus === "success"
      ? "Payment received — your plan or scan pack is now active."
      : checkoutStatus === "cancel"
        ? "Checkout canceled. You can try again anytime."
        : null,
  );

  async function startCheckout(productId: BillingProductId) {
    setPending(productId);
    setNotice(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      const data = await readResponseJson<{
        checkoutUrl?: string;
        message?: string;
        error?: string;
        code?: string;
      }>(res);
      if (res.ok && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      setNotice(
        data.message ??
          data.error ??
          (billingConfigured
            ? "Unable to start checkout."
            : "Add STRIPE_SECRET_KEY to enable checkout."),
      );
    } catch {
      setNotice("Unable to start checkout. Try again in a moment.");
    } finally {
      setPending(null);
      onPurchaseComplete?.();
    }
  }

  return (
    <div className="grid gap-5">
      {masterAdminPreview ? (
        <Card className="desk-surface-raised border-emerald-400/30 p-4">
          <p className="text-desk-label">Master admin preview</p>
          <p className="mt-1 text-sm text-muted">
            Your account has unlimited scans. Use the plans and packs below to test checkout, pricing UI, and Stripe
            setup — purchases still apply to this account for end-to-end testing.
          </p>
        </Card>
      ) : null}

      {notice ? (
        <p className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {notice}
        </p>
      ) : null}

      {bonusScans > 0 ? (
        <Card className="desk-surface-raised border-emerald-400/25 p-4">
          <p className="text-desk-label">Bonus balance</p>
          <p className="mt-1 font-display text-2xl font-semibold text-emerald-200">
            {bonusScans.toLocaleString()} scans
          </p>
          <p className="mt-1 text-xs text-muted">
            Used automatically when your plan allowance is full.
          </p>
        </Card>
      ) : null}

      <section id="upgrade" className="grid gap-4 lg:grid-cols-2">
        <PlanCard
          title="Free"
          price="$0"
          subline="Full workflow · free vision stack"
          active={!isPro}
          features={[...FREE_TIER_FEATURES]}
          limits="15 scans / month"
        />
        <PlanCard
          title="Pro"
          price={formatPrice(BILLING_PRODUCTS.pro_monthly.priceCents)}
          subline={`per month · or ${formatPrice(BILLING_PRODUCTS.pro_yearly.priceCents)}/year${
            yearlySavings > 0 ? ` (save ${formatPrice(yearlySavings)})` : ""
          }`}
          active={isPro}
          highlight
          features={[...PRO_TIER_FEATURES]}
          limits="80 scans / day · 3,000 / month"
          footer={
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {PRO_PRODUCTS.map((product) => (
                <Button
                  key={product.id}
                  variant={product.id === "pro_yearly" ? "scan" : "primary"}
                  size="sm"
                  disabled={pending != null}
                  onClick={() => void startCheckout(product.id)}
                >
                  {pending === product.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {product.label} · {formatPrice(product.priceCents)}
                  {product.interval === "year" ? "/yr" : "/mo"}
                </Button>
              ))}
            </div>
          }
        />
      </section>

      <section id="packs">
        <div className="mb-3">
          <p className="text-desk-label">Scan packs</p>
          <h2 className="mt-1 font-display text-xl font-semibold text-primary">Top up anytime</h2>
          <p className="mt-1 text-sm text-muted">
            Affordable add-ons based on API cost. Packs never expire and stack on your account.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {SCAN_PACK_PRODUCTS.map((product) => (
            <Card
              key={product.id}
              className={cn(
                "desk-surface-raised flex flex-col p-4",
                product.badge && "ring-1 ring-accent/30",
              )}
            >
              {product.badge ? (
                <span className="mb-2 w-fit rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-accent">
                  {product.badge}
                </span>
              ) : null}
              <p className="font-display text-lg font-semibold text-primary">{product.label}</p>
              <p className="mt-1 text-2xl font-semibold text-primary">{formatPrice(product.priceCents)}</p>
              {pricePerScan(product) ? (
                <p className="mt-0.5 text-xs text-muted">{pricePerScan(product)}</p>
              ) : null}
              <p className="mt-2 flex-1 text-xs text-muted">{product.description}</p>
              <Button
                className="mt-4 w-full"
                variant="secondary"
                size="sm"
                disabled={pending != null}
                onClick={() => void startCheckout(product.id)}
              >
                {pending === product.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Package className="h-4 w-4" />
                )}
                Buy pack
              </Button>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

function PlanCard({
  title,
  price,
  subline,
  limits,
  features,
  active,
  highlight,
  footer,
}: {
  title: string;
  price: string;
  subline: string;
  limits: string;
  features: string[];
  active?: boolean;
  highlight?: boolean;
  footer?: ReactNode;
}) {
  return (
    <Card
      className={cn(
        "desk-surface-raised flex flex-col p-5",
        highlight && "ring-1 ring-accent/35",
        active && "border-emerald-400/30",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-desk-label">{title}</p>
          <p className="mt-2 font-display text-3xl font-semibold text-primary">{price}</p>
          <p className="mt-1 text-sm text-muted">{subline}</p>
        </div>
        {active ? (
          <span className="rounded-full border border-emerald-400/35 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase text-emerald-200">
            Current
          </span>
        ) : null}
      </div>
      <p className="mt-3 font-mono text-xs text-accent">{limits}</p>
      <ul className="mt-4 flex-1 space-y-2">
        {features.map((item) => (
          <li key={item} className="flex gap-2 text-sm text-muted">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
            {item}
          </li>
        ))}
      </ul>
      {footer}
    </Card>
  );
}
