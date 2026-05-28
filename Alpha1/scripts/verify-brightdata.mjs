/**
 * Bright Data Crawl / Unlocker smoke test (reads .env.local; never prints secrets).
 *
 * Usage:
 *   node scripts/verify-brightdata.mjs
 *   node scripts/verify-brightdata.mjs --cert 12345678
 *   node scripts/verify-brightdata.mjs --catalog base1-4
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

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
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/#\s*brightdata\s*key:\s*([a-f0-9-]{36})/i);
    if (m && !process.env.BRIGHTDATA_API_KEY) {
      process.env.BRIGHTDATA_API_KEY = m[1];
    }
  }
}

loadEnvFile(envPath);

const apiKey = process.env.BRIGHTDATA_API_KEY?.trim() || "";
const datasetId = process.env.BRIGHTDATA_CRAWL_DATASET_ID?.trim() || "";
const zone = process.env.BRIGHTDATA_WEB_UNLOCKER_ZONE?.trim() || "";
const cronSecret = process.env.CRON_SECRET?.trim() || "";
const port = process.env.DEV_PORT?.trim() || "3002";

function mask(s) {
  if (!s || s.length < 8) return s ? "(set)" : "(missing)";
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

console.log("--- Bright Data env check ---");
console.log("env file:", existsSync(envPath) ? envPath : "(missing)");
console.log("BRIGHTDATA_API_KEY:", mask(apiKey));
console.log("BRIGHTDATA_CRAWL_DATASET_ID:", datasetId || "(missing — create Crawl API scraper in Bright Data CP)");
console.log("BRIGHTDATA_WEB_UNLOCKER_ZONE:", zone || "(missing — optional for single-page unlocker)");
console.log("Ready:", Boolean(apiKey && (datasetId || zone)));

const args = process.argv.slice(2);
const certIdx = args.indexOf("--cert");
const catalogIdx = args.indexOf("--catalog");

async function testUnlocker() {
  if (!apiKey || !zone) return { skipped: true };
  const url = "https://geo.brdtest.com/welcome.txt";
  const res = await fetch("https://api.brightdata.com/request?async=false", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ zone, url, format: "raw" }),
    signal: AbortSignal.timeout(60_000),
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, preview: text.slice(0, 120) };
}

async function testCrawlTrigger() {
  if (!apiKey || !datasetId) return { skipped: true };
  const params = new URLSearchParams({
    dataset_id: datasetId,
    include_errors: "true",
    format: "json",
  });
  const res = await fetch(
    `https://api.brightdata.com/datasets/v3/trigger?${params.toString()}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([{ url: "https://geo.brdtest.com/welcome.txt" }]),
      signal: AbortSignal.timeout(60_000),
    },
  );
  const text = await res.text();
  let snapshotId = null;
  try {
    snapshotId = JSON.parse(text).snapshot_id ?? null;
  } catch {
    /* */
  }
  return {
    ok: res.ok,
    status: res.status,
    snapshotId,
    bodyPreview: text.slice(0, 200),
  };
}

async function callLocalJob(query) {
  if (!cronSecret) {
    console.log("\nSkip local job — CRON_SECRET missing");
    return;
  }
  const url = `http://localhost:${port}/api/jobs/population-harvest?secret=${encodeURIComponent(cronSecret)}&${query}`;
  console.log("\n--- Local population-harvest ---");
  console.log("GET", url.replace(cronSecret, "***"));
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(300_000) });
    const json = await res.json();
    console.log("status:", res.status);
    console.log(JSON.stringify(json, null, 2).slice(0, 4000));
  } catch (e) {
    console.log("failed:", e instanceof Error ? e.message : String(e));
    console.log("(Start dev server: npm run dev)");
  }
}

const unlocker = await testUnlocker();
console.log("\n--- Web Unlocker probe (brdtest) ---");
console.log(unlocker.skipped ? "skipped (need zone)" : unlocker);

const crawl = await testCrawlTrigger();
console.log("\n--- Crawl API trigger probe (brdtest) ---");
console.log(crawl.skipped ? "skipped (need dataset_id)" : crawl);

if (certIdx >= 0 && args[certIdx + 1]) {
  await callLocalJob(
    `cert=${encodeURIComponent(args[certIdx + 1].replace(/\D/g, ""))}&grader=PSA`,
  );
}

if (catalogIdx >= 0 && args[catalogIdx + 1]) {
  await callLocalJob(`catalogId=${encodeURIComponent(args[catalogIdx + 1])}&graders=PSA`);
}

if (!apiKey) {
  console.error("\nAdd BRIGHTDATA_API_KEY to .env.local (see .env.example).");
  process.exit(1);
}
if (!datasetId && !zone) {
  console.error(
    "\nAdd BRIGHTDATA_CRAWL_DATASET_ID and/or BRIGHTDATA_WEB_UNLOCKER_ZONE from https://brightdata.com/cp/",
  );
  process.exit(1);
}
