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
  // Production Browse Client ID doubles as Finding SECURITY-APPNAME when no dedicated var.
  return firstConfiguredEnv("EBAY_CLIENT_ID", "EBAY_APP_ID");
}

export function getPriceChartingApiToken(): string | null {
  return firstConfiguredEnv("PRICECHARTING_API_TOKEN", "PRICECHARTING_TOKEN");
}

export function isEbayBrowseConfigured(): boolean {
  return Boolean(getEbayClientId() && getEbayClientSecret());
}

const POKETRACE_DEFAULT_BASE = "https://api.poketrace.com/v1";

export function getPokeTraceApiKey(): string | null {
  return firstConfiguredEnv("POKETRACE_API_KEY");
}

export function getPokeTraceBaseUrl(): string {
  return (
    firstConfiguredEnv("POKETRACE_BASE_URL")?.replace(/\/$/, "") ??
    POKETRACE_DEFAULT_BASE
  );
}

export function isPokeTraceConfigured(): boolean {
  return Boolean(getPokeTraceApiKey());
}

export function getPokeTraceWsUrl(): string {
  const custom = firstConfiguredEnv("POKETRACE_WS_URL");
  if (custom) return custom.replace(/\/$/, "");
  return getPokeTraceBaseUrl().replace(/^https:/i, "wss:").replace(/^http:/i, "ws:") + "/ws";
}

/**
 * WebSocket feed (PokeTrace Scale only). Opt-in: POKETRACE_WS_ENABLED=1.
 * REST/SSE work on Pro without WS — do not auto-enable when only API key is set.
 */
export function isPokeTraceWsEnabled(): boolean {
  if (!isPokeTraceConfigured()) return false;
  const flag = process.env.POKETRACE_WS_ENABLED?.trim().toLowerCase();
  return flag === "1" || flag === "true";
}

/** Prefer PokeTrace over Pokemon TCG API when key is set. MARKET_POKETRACE_PRIMARY=0 to disable. */
export function isPokeTracePrimary(): boolean {
  if (!isPokeTraceConfigured()) return false;
  const flag = process.env.MARKET_POKETRACE_PRIMARY?.trim().toLowerCase();
  if (flag === "0" || flag === "false") return false;
  return true;
}

/** Price history endpoint (Pro). POKETRACE_HISTORY=0 to skip extra API calls. */
export function isPokeTraceHistoryEnabled(): boolean {
  if (!isPokeTraceConfigured()) return false;
  const flag = process.env.POKETRACE_HISTORY?.trim().toLowerCase();
  if (flag === "0" || flag === "false") return false;
  return true;
}

const JUSTTCG_DEFAULT_BASE = "https://api.justtcg.com/v1";

export function getJustTcgApiKey(): string | null {
  return firstConfiguredEnv(
    "JUSTTCG_API_KEY",
    "Just_Pokemon_TCG_API_KEY",
    "JUST_POKEMON_TCG_API_KEY",
  );
}

export function getJustTcgBaseUrl(): string {
  return (
    firstConfiguredEnv("JUSTTCG_BASE_URL")?.replace(/\/$/, "") ?? JUSTTCG_DEFAULT_BASE
  );
}

export function isJustTcgConfigured(): boolean {
  if (process.env.JUSTTCG_ENABLED === "0") return false;
  return Boolean(getJustTcgApiKey());
}
