import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { grantBillingProduct } from "@/lib/billing/grant";
import { productIdFromMetadata } from "@/lib/billing/stripe";
import { getStripe } from "@/lib/billing/stripe";
import { isBillingConfigured } from "@/lib/billing/pricing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function fulfillSession(session: Stripe.Checkout.Session) {
  const appUserId = session.metadata?.app_user_id ?? session.client_reference_id;
  const productId = productIdFromMetadata(session.metadata?.product_id);
  if (!appUserId || !productId) {
    throw new Error("Missing checkout metadata");
  }
  await grantBillingProduct(appUserId, productId);
}

export async function POST(req: Request) {
  if (!isBillingConfigured()) {
    return NextResponse.json({ error: "Billing not configured" }, { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  const payload = await req.text();
  const stripe = getStripe();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!.trim(),
    );
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status === "paid" || session.status === "complete") {
        await fulfillSession(session);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook handler failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
