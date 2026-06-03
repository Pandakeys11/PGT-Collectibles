/**
 * Pre-build idle Market Intelligence daily TCG desk.
 * Usage: npm run market:daily-brief
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

const url = new URL(`${origin}/api/jobs/market-daily-brief`);
url.searchParams.set("secret", secret);

console.log(`GET ${url.origin}${url.pathname} …`);
const res = await fetch(url.toString(), { method: "GET" });
const body = await res.json().catch(() => ({}));
console.log(JSON.stringify(body, null, 2));
if (!res.ok) process.exit(1);
