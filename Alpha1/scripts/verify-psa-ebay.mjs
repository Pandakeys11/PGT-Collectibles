/**
 * PSA Public API + eBay credentials smoke test (reads .env.local; never prints secrets).
 *
 * Usage:
 *   node scripts/verify-psa-ebay.mjs
 *   node scripts/verify-psa-ebay.mjs --cert 12345678
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

const root = resolve(process.cwd());
const envPath = resolve(root, ".env.local");

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
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

function clean(key) {
  const raw = process.env[key]?.trim();
  if (!raw || /^(your_|replace|paste|<)/i.test(raw)) return null;
  return raw.replace(/^["']|["']$/g, "");
}

function mask(s) {
  if (!s || s.length < 8) return s ? "(set)" : "(missing)";
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

function psaAuthMode() {
  if (clean("PSA_API_ACCESS_TOKEN")) return "PSA_API_ACCESS_TOKEN";
  if (clean("PSA_API_KEY")) return "PSA_API_KEY";
  if (
    clean("PSA_API_CLIENT_ID") &&
    clean("PSA_API_CLIENT_SECRET") &&
    clean("PSA_API_USERNAME") &&
    clean("PSA_API_PASSWORD")
  ) {
    return "oauth_password";
  }
  return null;
}

function readQuota() {
  const path = join(
    process.env.PSA_API_QUOTA_CACHE_DIR?.trim() || join(root, ".cache"),
    "psa-api-quota.json",
  );
  const today = new Date().toISOString().slice(0, 10);
  const limit = Number(process.env.PSA_API_DAILY_LIMIT ?? 100) || 100;
  if (!existsSync(path)) return { date: today, used: 0, limit, remaining: limit };
  try {
    const raw = JSON.parse(readFileSync(path, "utf8"));
    if (raw?.date !== today) return { date: today, used: 0, limit, remaining: limit };
    const used = Number(raw.count) || 0;
    return { date: today, used, limit, remaining: Math.max(0, limit - used) };
  } catch {
    return { date: today, used: 0, limit, remaining: limit };
  }
}

async function getPsaToken() {
  const manual = clean("PSA_API_ACCESS_TOKEN") ?? clean("PSA_API_KEY");
  if (manual) return { token: manual, mode: psaAuthMode() };

  const tokenUrl =
    clean("PSA_API_TOKEN_URL") || "https://api.psacard.com/publicapi/oauth/token";
  const body = new URLSearchParams({
    grant_type: "password",
    username: clean("PSA_API_USERNAME"),
    password: clean("PSA_API_PASSWORD"),
    client_id: clean("PSA_API_CLIENT_ID"),
    client_secret: clean("PSA_API_CLIENT_SECRET"),
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    signal: AbortSignal.timeout(12_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    return { token: null, mode: "oauth_password", error: data.error || `HTTP ${res.status}` };
  }
  return { token: data.access_token, mode: "oauth_password" };
}

async function testPsaCert(token, cert) {
  const base = clean("PSA_API_BASE_URL") || "https://api.psacard.com/publicapi";
  const res = await fetch(`${base}/cert/GetByCertNumber/${cert}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { preview: text.slice(0, 200) };
  }
  const psaCert = data?.PSACert ?? data;
  const card =
    psaCert?.Subject || psaCert?.CardName || data?.Subject || data?.CardName || null;
  const grade = psaCert?.CardGrade || psaCert?.Grade || data?.CardGrade || null;
  return {
    ok: res.ok,
    status: res.status,
    card,
    grade,
    serverMessage: data?.ServerMessage ?? null,
    isValid: data?.IsValidRequest,
  };
}

async function testEbayOAuth() {
  const clientId = clean("EBAY_CLIENT_ID") || clean("EBAY_APP_ID");
  const clientSecret = clean("EBAY_CLIENT_SECRET") || clean("EBAY_CERT_ID");
  if (!clientId || !clientSecret) {
    return { skipped: true, reason: "missing EBAY_CLIENT_ID / EBAY_CLIENT_SECRET" };
  }
  const sandbox =
    (clean("EBAY_API_ENV") || "").toLowerCase() === "sandbox" ||
    clean("EBAY_USE_SANDBOX") === "1";
  const tokenUrl = sandbox
    ? "https://api.sandbox.ebay.com/identity/v1/oauth2/token"
    : "https://api.ebay.com/identity/v1/oauth2/token";
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "https://api.ebay.com/oauth/api_scope",
    }).toString(),
    signal: AbortSignal.timeout(12_000),
  });
  const data = await res.json().catch(() => ({}));
  return {
    ok: res.ok && Boolean(data.access_token),
    status: res.status,
    env: sandbox ? "sandbox" : "production",
    error: data.error || data.error_description || null,
  };
}

function findingAppId() {
  return (
    clean("EBAY_FINDING_APP_ID") ||
    clean("EBAY_DEV_ID") ||
    clean("EBAY_APP_ID_DEV") ||
    (clean("EBAY_API_ENV") !== "sandbox" ? clean("EBAY_CLIENT_ID") : null)
  );
}

console.log("--- PSA + eBay env check ---");
console.log("env file:", existsSync(envPath) ? envPath : "(missing)");

const psaMode = psaAuthMode();
const quota = readQuota();
console.log("\nPSA Public API:");
console.log("  auth:", psaMode || "(not configured)");
console.log("  PSA_API_KEY:", mask(clean("PSA_API_KEY")));
console.log("  daily quota:", `${quota.used}/${quota.limit} used (${quota.remaining} left)`);

console.log("\neBay:");
console.log("  EBAY_CLIENT_ID (Browse OAuth):", mask(clean("EBAY_CLIENT_ID")));
console.log("  EBAY_CLIENT_SECRET:", clean("EBAY_CLIENT_SECRET") ? "(set)" : "(missing)");
console.log("  EBAY_DEV_ID (Finding App ID):", mask(clean("EBAY_DEV_ID")));
console.log("  EBAY_FINDING_APP_ID:", mask(clean("EBAY_FINDING_APP_ID")));
console.log("  resolved Finding App ID:", mask(findingAppId()));
console.log("  EBAY_DISABLE_FINDING:", process.env.EBAY_DISABLE_FINDING ?? "0");

const certIdx = process.argv.indexOf("--cert");
const certArg =
  certIdx >= 0 ? (process.argv[certIdx + 1] || "").replace(/\D/g, "") : "";

if (psaMode) {
  console.log("\n--- PSA token ---");
  const { token, error } = await getPsaToken();
  if (!token) {
    console.log("FAIL:", error || "no token");
  } else {
    console.log("OK: bearer obtained via", psaMode);
    if (certArg.length >= 6) {
      console.log("\n--- PSA cert lookup (uses 1 quota unit in app; script does not increment cache) ---");
      const hit = await testPsaCert(token, certArg);
      console.log("cert:", certArg);
      console.log("HTTP:", hit.status, hit.ok ? "OK" : "FAIL");
      console.log("card:", hit.card || "(none)");
      console.log("grade:", hit.grade || "(none)");
      console.log("ServerMessage:", hit.serverMessage);
      console.log("IsValidRequest:", hit.isValid);
    } else {
      console.log("\nTip: pass a real slab cert to exercise the API:");
      console.log("  node scripts/verify-psa-ebay.mjs --cert YOUR_CERT_NUMBER");
    }
  }
} else {
  console.log("\nPSA: add PSA_API_KEY from https://www.psacard.com/publicapi (portal token)");
}

console.log("\n--- eBay Browse OAuth ---");
const ebay = await testEbayOAuth();
if (ebay.skipped) {
  console.log("skipped:", ebay.reason);
} else {
  console.log(ebay.ok ? "OK" : "FAIL", `(${ebay.env}, HTTP ${ebay.status})`);
  if (ebay.error) console.log("error:", ebay.error);
}

console.log("\nPolicy: PSA API = user cert enrich only (~100/day). Catalog pop = Bright Data harvest.");
