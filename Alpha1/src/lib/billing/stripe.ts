import "server-only";

import Stripe from "stripe";
import { BILLING_PRODUCTS, type BillingProduct, type BillingProductId } from "@/lib/billing/pricing";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  if (!stripeClient) {
    stripeClient = new Stripe(key, { apiVersion: "2025-02-24.acacia" });
  }
  return stripeClient;
}

export function appOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3002";
}

export function stripeLineItem(product: BillingProduct): Stripe.Checkout.SessionCreateParams.LineItem {
  const priceData: Stripe.Checkout.SessionCreateParams.LineItem.PriceData = {
    currency: "usd",
    unit_amount: product.priceCents,
    product_data: {
      name: product.label,
      description: product.description,
    },
  };

  if (product.interval) {
    priceData.recurring = {
      interval: product.interval === "year" ? "year" : "month",
    };
  }

  return {
    quantity: 1,
    price_data: priceData,
  };
}

export function checkoutMode(product: BillingProduct): Stripe.Checkout.SessionCreateParams.Mode {
  return product.interval ? "subscription" : "payment";
}

export function productIdFromMetadata(value: string | undefined): BillingProductId | null {
  if (!value) return null;
  return value in BILLING_PRODUCTS ? (value as BillingProductId) : null;
}
