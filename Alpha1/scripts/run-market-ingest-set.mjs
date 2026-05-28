/**
 * Run full-set market ingest locally (no Vercel 300s cap). Continues set cursor until done.
 *
 *   npm run market:ingest:set
 *   npm run market:ingest:set -- base1
 *   npm run market:ingest:set -- --maxCards=200 --runs=20
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
let setCode = "";
let maxCards = 120;
let runs = 30;
let concurrency = 5;
for (const arg of args) {
  if (arg.startsWith("--maxCards=")) maxCards = Number(arg.slice(11)) || 120;
  else if (arg.startsWith("--runs=")) runs = Number(arg.slice(7)) || 30;
  else if (arg.startsWith("--concurrency=")) concurrency = Number(arg.slice(14)) || 5;
  else if (!arg.startsWith("--")) setCode = arg.trim();
}

for (let i = 0; i < runs; i += 1) {
  const url = new URL(`${origin}/api/jobs/market-ingest`);
  url.searchParams.set("secret", secret);
  url.searchParams.set("maxCards", String(maxCards));
  url.searchParams.set("concurrency", String(concurrency));
  url.searchParams.set("timeBudgetMs", "600000");
  if (setCode) url.searchParams.set("setCode", setCode);

  console.log(`\n[${i + 1}/${runs}] GET ${url.pathname}?set=…`);
  const res = await fetch(url.toString(), { method: "GET" });
  const body = await res.json().catch(() => ({}));
  console.log(JSON.stringify(body, null, 2));
  if (!res.ok) process.exit(1);

  if (body.set?.setCompleteAfterRun && body.stoppedReason === "complete") {
    console.log(`\nSet ${body.set.code} complete.`);
    if (setCode) break;
  }
  if (body.processed === 0) {
    console.log("No cards processed; stopping.");
    break;
  }
}
