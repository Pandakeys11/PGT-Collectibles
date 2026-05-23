/**
 * Smoke: env, Supabase, dev server, ngrok, Clerk webhook config.
 * Usage: node scripts/smoke-stack.mjs [baseUrl]
 */
import { loadEnvLocal } from "./load-env-local.mjs";

loadEnvLocal();

const baseUrl = (process.argv[2] ?? "http://localhost:3002").replace(/\/$/, "");

const checks = [];

function pass(name, detail = "") {
  checks.push({ name, ok: true, detail });
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, detail = "") {
  checks.push({ name, ok: false, detail });
  console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
}

function warn(name, detail = "") {
  checks.push({ name, ok: true, warn: true, detail });
  console.log(`  ⚠ ${name}${detail ? ` — ${detail}` : ""}`);
}

async function get(path) {
  const res = await fetch(`${baseUrl}${path}`, { redirect: "manual" });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, json, text: text.slice(0, 200) };
}

async function testEnv() {
  console.log("\n1. Environment");
  const clerkPk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();
  const clerkSk = process.env.CLERK_SECRET_KEY?.trim();
  const clerkWh = process.env.CLERK_WEBHOOK_SECRET?.trim();
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const ngrok = process.env.NGROK_AUTHTOKEN?.trim();

  if (clerkPk?.startsWith("pk_")) pass("Clerk publishable key");
  else fail("Clerk publishable key", "missing or invalid");

  if (clerkSk?.startsWith("sk_")) pass("Clerk secret key");
  else fail("Clerk secret key", "missing or invalid");

  if (clerkWh?.startsWith("whsec_")) pass("Clerk webhook secret");
  else warn("Clerk webhook secret", "empty — webhooks will not verify");

  if (sbUrl?.includes(".supabase.co") && !sbUrl.includes("/rest/v1")) pass("Supabase URL shape");
  else fail("Supabase URL", sbUrl || "missing");

  if (sbKey?.length > 20) pass("Supabase service role key");
  else fail("Supabase service role key", "missing");

  if (ngrok?.length > 10) pass("NGROK_AUTHTOKEN");
  else warn("NGROK_AUTHTOKEN", "missing — tunnel scripts need it");
}

async function testSupabase() {
  console.log("\n2. Supabase");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    fail("Supabase connection", "URL or key not set");
    return;
  }

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error: usersErr } = await client.from("app_users").select("id", { count: "exact", head: true });
    if (usersErr) {
      fail("app_users table", usersErr.message);
      return;
    }
    pass("app_users table reachable");

    const { count, error: countErr } = await client.from("app_users").select("*", { count: "exact", head: true });
    if (countErr) fail("app_users count", countErr.message);
    else pass("app_users rows", `${count ?? 0} user(s)`);
  } catch {
    fail("Supabase connection", e instanceof Error ? e.message : String(e));
  }
}

async function testDevServer() {
  console.log("\n3. Dev server");
  try {
    const home = await get("/");
    if (home.status >= 200 && home.status < 400) pass(`GET /`, `status ${home.status}`);
    else fail(`GET /`, `status ${home.status}`);

    const liquid = await get("/liquid-scan");
    if (liquid.status === 307 || liquid.status === 302 || liquid.status === 200) {
      pass(`GET /liquid-scan`, `status ${liquid.status} (auth may redirect)`);
    } else fail(`GET /liquid-scan`, `status ${liquid.status}`);

    const legacyDisabled = process.env.LEGACY_SCANNER_ENABLED === "0";
    const scanner = await get("/scanner");
    if (legacyDisabled) {
      if (scanner.status === 410) pass(`GET /scanner`, "410 Gone (legacy disabled)");
      else fail(`GET /scanner`, `expected 410, got ${scanner.status}`);
    } else if (scanner.status === 307 || scanner.status === 302 || scanner.status === 200) {
      pass(`GET /scanner`, `legacy redirect status ${scanner.status}`);
    } else fail(`GET /scanner`, `status ${scanner.status}`);

    const webhook = await fetch(`${baseUrl}/api/webhooks/clerk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (webhook.status === 400) pass("Clerk webhook route", "reachable (400 without signature = expected)");
    else if (webhook.status === 503) warn("Clerk webhook route", "503 — CLERK_WEBHOOK_SECRET or Supabase missing");
    else pass("Clerk webhook route", `status ${webhook.status}`);
  } catch {
    fail("Dev server", `not reachable at ${baseUrl} — is npm run dev running?`);
  }
}

async function testNgrok() {
  console.log("\n4. ngrok");
  try {
    const res = await fetch("http://127.0.0.1:4040/api/tunnels");
    if (!res.ok) {
      warn("ngrok tunnel", "not running (start npm run dev:tunnel or npm run tunnel)");
      return;
    }
    const body = await res.json();
    const https = (body.tunnels ?? []).find((t) => t.public_url?.startsWith("https://"));
    if (https?.public_url) {
      pass("ngrok public URL", https.public_url);
      pass("Clerk webhook URL", `${https.public_url}/api/webhooks/clerk`);
    } else warn("ngrok", "API up but no HTTPS tunnel");
  } catch {
    warn("ngrok", "not running on :4040");
  }
}

async function testEnrich() {
  console.log("\n5. Market enrich API");
  try {
    const res = await fetch(`${baseUrl}/api/scan/enrich`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        specimenId: "smoke-stack",
        card: { name: "Pikachu", set: "Base Set", number: "58/102", visionLane: "raw" },
        phase: "catalog",
      }),
    });
    if (res.status === 401 || res.status === 307) {
      warn("POST /api/scan/enrich", `status ${res.status} — auth required (expected in production mode)`);
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (res.ok) pass("POST /api/scan/enrich catalog", `catalogId=${data.catalogId ?? "n/a"}`);
    else fail("POST /api/scan/enrich", `status ${res.status}: ${JSON.stringify(data).slice(0, 120)}`);
  } catch (e) {
    fail("Market enrich", e instanceof Error ? e.message : String(e));
  }
}

async function main() {
  console.log(`PGT Vision stack smoke → ${baseUrl}`);
  await testEnv();
  await testSupabase();
  await testDevServer();
  await testNgrok();
  await testEnrich();

  const failed = checks.filter((c) => !c.ok);
  const warnings = checks.filter((c) => c.warn);

  console.log("\n────────────────────────────────────────");
  if (failed.length === 0) {
    console.log(`Done: ${checks.length - warnings.length} passed, ${warnings.length} warning(s).`);
    process.exit(0);
  } else {
    console.log(`Done: ${failed.length} failed, ${warnings.length} warning(s).`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
