import { loadEnvLocal } from "./load-env-local.mjs";

loadEnvLocal();

const apiEnv = (() => {
  const raw = (process.env.EBAY_API_ENV ?? process.env.EBAY_ENV ?? "").trim().toLowerCase();
  if (raw === "sandbox" || raw === "dev" || raw === "development") return "sandbox";
  if (process.env.EBAY_USE_SANDBOX === "1" || process.env.EBAY_USE_SANDBOX?.toLowerCase() === "true") {
    return "sandbox";
  }
  return "production";
})();

function pick(...keys) {
  for (const key of keys) {
    const v = process.env[key]?.trim();
    if (v) return v;
  }
  return null;
}

const clientId =
  apiEnv === "sandbox"
    ? pick("EBAY_SANDBOX_CLIENT_ID", "EBAY_SANDBOX_APP_ID", "EBAY_CLIENT_ID", "EBAY_APP_ID")
    : pick("EBAY_CLIENT_ID", "EBAY_APP_ID");
const secret =
  apiEnv === "sandbox"
    ? pick("EBAY_SANDBOX_CLIENT_SECRET", "EBAY_SANDBOX_CERT_ID", "EBAY_CLIENT_SECRET", "EBAY_CERT_ID")
    : pick("EBAY_CLIENT_SECRET", "EBAY_CERT_ID");

const configured = Boolean(clientId && secret);

export function logEbayBrowseEnvHint() {
  if (configured) {
    console.log(`eBay Browse OAuth: ready (${apiEnv}, client id set).`);
    return;
  }
  console.warn(
    `eBay Browse OAuth: NOT configured (${apiEnv}). Set EBAY_CLIENT_ID + EBAY_CLIENT_SECRET in .env.local, then restart dev.`,
  );
}
