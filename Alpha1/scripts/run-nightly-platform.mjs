/**
 * Trigger nightly platform job (catalog sync + market memory).
 * Usage: npm run platform:nightly
 */
import { loadEnvLocal } from "./load-env-local.mjs";

loadEnvLocal();

const base =
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  process.env.VERCEL_URL?.trim() ||
  "http://localhost:3002";
const origin = base.startsWith("http") ? base.replace(/\/$/, "") : `https://${base}`;
const secret = process.env.CRON_SECRET?.trim();
if (!secret) {
  console.error("CRON_SECRET missing in .env.local");
  process.exit(1);
}

const marketLimit = process.argv[2]?.trim() || "12";
const url = new URL(`${origin}/api/jobs/nightly-platform`);
url.searchParams.set("secret", secret);
url.searchParams.set("marketLimit", marketLimit);

console.log(`GET ${url.origin}${url.pathname} …`);
const res = await fetch(url.toString(), { method: "GET" });
const body = await res.json().catch(() => ({}));
console.log(JSON.stringify(body, null, 2));
if (!res.ok) process.exit(1);
