import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { syncCurrentAppUser } from "@/lib/auth/app-user";
import {
  BILLING_PRODUCTS,
  type BillingProductId,
  isBillingConfigured,
} from "@/lib/billing/pricing";
import { appOrigin, checkoutMode, getStripe, stripeLineItem } from "@/lib/billing/stripe";

const productIds = [
  "pro_monthly",
  "pro_yearly",
  "scan_pack_starter",
  "scan_pack_collector",
  "scan_pack_bulk",
] as const satisfies readonly BillingProductId[];

const bodySchema = z.object({
  productId: z.enum(productIds),
});

export async function POST(req: Request) {
  await auth.protect();
  const appUser = await syncCurrentAppUser();
  if (!appUser) {
    return NextResponse.json({ error: "Account not synced" }, { status: 503 });
  }

  let productId: BillingProductId;
  try {
    const json = await req.json();
    productId = bodySchema.parse(json).productId;
  } catch {
    return NextResponse.json({ error: "Invalid product" }, { status: 400 });
  }

  const product = BILLING_PRODUCTS[productId];

  if (!isBillingConfigured()) {
    return NextResponse.json(
      {
        error: "Billing is not configured",
        code: "billing_not_configured",
        message: "Add STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET to enable checkout.",
      },
      { status: 503 },
    );
  }

  const origin = appOrigin();
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: checkoutMode(product),
    line_items: [stripeLineItem(product)],
    success_url: `${origin}/usage?checkout=success&product=${productId}`,
    cancel_url: `${origin}/usage?checkout=cancel`,
    client_reference_id: appUser.id,
    customer_email: appUser.email ?? undefined,
    metadata: {
      app_user_id: appUser.id,
      product_id: productId,
    },
    subscription_data:
      product.interval
        ? {
            metadata: {
              app_user_id: appUser.id,
              product_id: productId,
            },
          }
        : undefined,
  });

  if (!session.url) {
    return NextResponse.json({ error: "Unable to create checkout session" }, { status: 500 });
  }

  return NextResponse.json({ checkoutUrl: session.url });
}
