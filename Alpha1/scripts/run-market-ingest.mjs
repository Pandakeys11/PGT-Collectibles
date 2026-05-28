/**
 * Trigger institutional market ingest (cron job).
 * Usage:
 *   npm run market:ingest
 *   npm run market:ingest -- neo2-9
 *   npm run market:ingest -- --maxCards=80
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

const args = process.argv.slice(2);
let catalogId = "";
let maxCards = "";
let setCode = "";
for (const arg of args) {
  if (arg.startsWith("--maxCards=")) maxCards = arg.slice(11);
  else if (arg.startsWith("--set=")) setCode = arg.slice(6).trim();
  else if (!arg.startsWith("--")) catalogId = arg.trim();
}

const url = new URL(`${origin}/api/jobs/market-ingest`);
url.searchParams.set("secret", secret);
if (catalogId) url.searchParams.set("catalogId", catalogId);
else {
  if (maxCards) url.searchParams.set("maxCards", maxCards);
  if (setCode) url.searchParams.set("setCode", setCode);
}

console.log(`POST ${url.origin}${url.pathname} …`);
const res = await fetch(url.toString(), { method: "GET" });
const body = await res.json().catch(() => ({}));
console.log(JSON.stringify(body, null, 2));
if (!res.ok) process.exit(1);
