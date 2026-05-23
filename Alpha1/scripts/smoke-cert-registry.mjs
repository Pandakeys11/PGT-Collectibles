/**
 * Cert registry smoke test — reads .env.local (no secrets printed).
 * Usage: node scripts/smoke-cert-registry.mjs [PSA_CERT_NUMBER]
 * Example: node scripts/smoke-cert-registry.mjs 12345678
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const envPath = resolve(root, ".env.local");

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile(envPath);

function tokenStatus() {
  const t =
    process.env.APIFY_API_TOKEN?.trim() || process.env.APIFY_TOKEN?.trim() || "";
  if (!t) return { ok: false, reason: "missing APIFY_API_TOKEN in .env.local" };
  if (/^(your_|replace|paste)/i.test(t)) {
    return { ok: false, reason: "APIFY_API_TOKEN looks like a placeholder" };
  }
  if (!t.startsWith("apify_api_")) {
    return {
      ok: true,
      warn: "token does not start with apify_api_ — confirm it is a Personal API token from Integrations",
    };
  }
  return { ok: true };
}

const cert = (process.argv[2] || "").replace(/\D/g, "");
if (!cert || cert.length < 6) {
  console.error("Usage: node scripts/smoke-cert-registry.mjs <PSA_CERT_NUMBER>");
  console.error("Pass a real cert from a slab (dummy numbers often TIMED-OUT on Apify).");
  process.exit(1);
}
const apify = tokenStatus();

console.log("--- Cert registry env check ---");
console.log("env file:", existsSync(envPath) ? envPath : "(missing)");
console.log("GEMRATE_API_KEY:", Boolean(process.env.GEMRATE_API_KEY?.trim()));
console.log(
  "PSA Public API OAuth:",
  Boolean(
    process.env.PSA_API_CLIENT_ID?.trim() &&
      process.env.PSA_API_CLIENT_SECRET?.trim() &&
      process.env.PSA_API_USERNAME?.trim() &&
      process.env.PSA_API_PASSWORD?.trim(),
  ),
);
console.log("PSA_API_ACCESS_TOKEN:", Boolean(process.env.PSA_API_ACCESS_TOKEN?.trim()));
console.log("PSA_CERT_PAGE_SCRAPE:", process.env.PSA_CERT_PAGE_SCRAPE !== "0");
console.log("CERT_REGISTRY_APIFY disabled:", process.env.CERT_REGISTRY_APIFY === "0");
console.log("APIFY_API_TOKEN:", apify.ok ? "set" : `NOT OK — ${apify.reason}`);
if (apify.warn) console.log("  warn:", apify.warn);

if (!apify.ok) {
  console.log("\nFix: paste Apify Personal API token into .env.local as APIFY_API_TOKEN=");
  console.log("https://console.apify.com/account/integrations");
  process.exit(1);
}

const actorId = "lulzasaur~psa-pop-scraper";
const timeoutSec = Math.min(
  Math.max(Number(process.env.APIFY_PSA_TIMEOUT_SEC ?? 120) || 120, 30),
  300,
);
const url = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?timeout=${timeoutSec}`;

console.log("\n--- Apify PSA cert lookup (test cert:", cert, ") ---");

const res = await fetch(url, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.APIFY_API_TOKEN?.trim() || process.env.APIFY_TOKEN?.trim()}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ certNumber: cert, cacheDurationHours: 168 }),
  signal: AbortSignal.timeout((timeoutSec + 20) * 1000),
});

if (!res.ok) {
  console.error("Apify failed HTTP", res.status, (await res.text()).slice(0, 500));
  process.exit(1);
}

const items = await res.json();
if (!Array.isArray(items) || items.length === 0) {
  console.error("Apify returned no items — try another cert number");
  process.exit(1);
}

const row = items[0];
console.log("OK — first row keys:", Object.keys(row).join(", "));
console.log("  subject:", row.subject ?? row.cardName ?? "(none)");
console.log("  grade:", row.grade ?? row.cardGrade ?? "(none)");
console.log("  psaPop.total:", row.psaPop?.total ?? "(none)");
console.log("\nGraded enrich will use: Apify → PSA cert page → web when cert is on scanned slab.");
