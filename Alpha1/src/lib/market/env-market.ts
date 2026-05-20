import { firstConfiguredEnv } from "@/lib/ai/env";

export type EbayApiEnv = "production" | "sandbox";

/** `sandbox` → api.sandbox.ebay.com (Sandbox keyset). Default `production`. */
export function getEbayApiEnv(): EbayApiEnv {
  const raw = firstConfiguredEnv("EBAY_API_ENV", "EBAY_ENV")?.toLowerCase() ?? "";
  if (raw === "sandbox" || raw === "dev" || raw === "development") return "sandbox";
  const flag = process.env.EBAY_USE_SANDBOX?.trim();
  if (flag === "1" || flag?.toLowerCase() === "true") return "sandbox";
  return "production";
}

/** OAuth client id for Buy Browse (client_credentials). Sandbox: prefer sandbox-specific vars when set. */
export function getEbayClientId(): string | null {
  if (getEbayApiEnv() === "sandbox") {
    return firstConfiguredEnv("EBAY_SANDBOX_CLIENT_ID", "EBAY_SANDBOX_APP_ID", "EBAY_CLIENT_ID", "EBAY_APP_ID");
  }
  return firstConfiguredEnv("EBAY_CLIENT_ID", "EBAY_APP_ID");
}

export function getEbayClientSecret(): string | null {
  if (getEbayApiEnv() === "sandbox") {
    return firstConfiguredEnv("EBAY_SANDBOX_CLIENT_SECRET", "EBAY_SANDBOX_CERT_ID", "EBAY_CLIENT_SECRET", "EBAY_CERT_ID");
  }
  return firstConfiguredEnv("EBAY_CLIENT_SECRET", "EBAY_CERT_ID");
}

/**
 * Finding `findCompletedItems` uses production `svcs.ebay.com` with `SECURITY-APPNAME` (App ID).
 * Optional `EBAY_FINDING_APP_ID` when Browse is Sandbox but sold Finding should use a Production App ID.
 */
export function getEbayFindingAppId(): string | null {
  const dedicated = firstConfiguredEnv("EBAY_FINDING_APP_ID");
  if (dedicated) return dedicated;
  if (getEbayApiEnv() === "sandbox") return null;
  return firstConfiguredEnv("EBAY_CLIENT_ID", "EBAY_APP_ID");
}

export function getPriceChartingApiToken(): string | null {
  return firstConfiguredEnv("PRICECHARTING_API_TOKEN", "PRICECHARTING_TOKEN");
}
