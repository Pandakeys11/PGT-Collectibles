import "server-only";

import { firstConfiguredEnv } from "@/lib/ai/env";

/** Slabz Partner API — devnet default per https://api-docs.slabz.com/getting-started */
export const SLABZ_DEVNET_API_BASE =
  "https://api-staging-3e2d.up.railway.app/api/partner/v1";

export function getSlabzApiKey(): string | null {
  return firstConfiguredEnv("SLABZ_API_KEY", "SLABZ_PARTNER_API_KEY");
}

export function getSlabzApiBaseUrl(): string {
  return (
    process.env.SLABZ_API_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SLABZ_API_BASE_URL?.trim() ||
    SLABZ_DEVNET_API_BASE
  );
}

export function isSlabzPartnerConfigured(): boolean {
  return Boolean(getSlabzApiKey());
}

export function getSlabzNetwork(): "devnet" | "mainnet" {
  const raw = process.env.SLABZ_NETWORK?.trim().toLowerCase();
  return raw === "mainnet" ? "mainnet" : "devnet";
}

export function getSlabzDocsUrl(): string {
  return "https://api-docs.slabz.com/";
}
