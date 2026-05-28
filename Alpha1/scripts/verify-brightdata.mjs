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
const ebayFlag = args.includes("--ebay");

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

async function testEbaySold() {
  if (!apiKey || !zone) return { skipped: true };
  const keyword = "Pokemon Charizard Base Set 4 PSA 9";
  const q = encodeURIComponent(keyword.replace(/[^\w\s-]/g, " ").trim());
  const url = `https://www.ebay.com/sch/i.html?_nkw=${q}&LH_Complete=1&LH_Sold=1&_sacat=2536&_ipg=40`;
  const body = { zone, url, format: "raw", country: "us", render: true };
  const expect = process.env.BRIGHTDATA_EBAY_EXPECT_SELECTOR?.trim();
  if (expect) {
    body.headers = { "x-unblock-expect": JSON.stringify({ element: expect }) };
  }
  const res = await fetch("https://api.brightdata.com/request?async=false", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  const brdStatus = res.headers.get("x-brd-status-code");
  let text = await res.text();
  if (text.trim().startsWith("{")) {
    try {
      const j = JSON.parse(text);
      text =
        (typeof j.body === "string" && j.body) ||
        (typeof j.response === "string" && j.response) ||
        text;
    } catch {
      /* */
    }
  }
  const sItems = text.match(/class="[^"]*\bs-item\b/gi) ?? [];
  const itm = text.match(/\/itm\//gi) ?? [];
  return {
    ok: res.ok && (!brdStatus || brdStatus === "200"),
    status: res.status,
    brdStatus,
    bytes: text.length,
    sItemBlocks: sItems.length,
    itmLinks: itm.length,
    preview: text.slice(0, 100).replace(/\s+/g, " "),
  };
}

const unlocker = await testUnlocker();
console.log("\n--- Web Unlocker probe (brdtest) ---");
console.log(unlocker.skipped ? "skipped (need zone)" : unlocker);

if (ebayFlag) {
  console.log("\n--- eBay sold SERP (Bright Data) ---");
  const ebay = await testEbaySold();
  console.log(ebay.skipped ? "skipped" : ebay);
  if (!ebay.skipped && ebay.sItemBlocks < 3 && ebay.itmLinks < 3) {
    console.log(
      "\nHint: enable Premium domains for ebay.com in CP, or set BRIGHTDATA_UNLOCKER_EBAY_RENDER=1",
    );
  }
}

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
