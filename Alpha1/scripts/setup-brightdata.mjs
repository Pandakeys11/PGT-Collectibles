/**
 * Provision Bright Data Web Unlocker zone + list Crawl datasets.
 * Reads .env.local; writes BRIGHTDATA_WEB_UNLOCKER_ZONE and BRIGHTDATA_CRAWL_DATASET_ID when found/created.
 *
 * Usage: node scripts/setup-brightdata.mjs
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const envPath = resolve(root, ".env.local");
const ZONE_NAME = "pgt_web_unlocker";

function loadEnv() {
  if (!existsSync(envPath)) {
    console.error("Missing .env.local");
    process.exit(1);
  }
  const text = readFileSync(envPath, "utf8");
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
    process.env[key] = val;
  }
  return text;
}

function upsertEnv(text, key, value) {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(text)) return text.replace(re, line);
  return `${text.trimEnd()}\n${line}\n`;
}

async function api(method, path, body) {
  const key = process.env.BRIGHTDATA_API_KEY?.trim();
  if (!key) throw new Error("BRIGHTDATA_API_KEY missing in .env.local");

  const res = await fetch(`https://api.brightdata.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(90_000),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 500) };
  }
  return { ok: res.ok, status: res.status, json, text: text.slice(0, 800) };
}

async function listZones() {
  for (const path of ["/zone", "/zones", "/zone/list"]) {
    const r = await api("GET", path);
    if (r.ok && r.json) return { path, data: r.json };
  }
  return null;
}

async function createUnlockerZone(name) {
  const payloads = [
    {
      zone: { name, type: "unblocker" },
      plan: { type: "unblocker", country: "us", solve_captcha_disable: false, custom_headers: true },
    },
    {
      zone: { name, type: "unblocker" },
      plan: { country: "us", solve_captcha_disable: false, custom_headers: true },
    },
    {
      zone: { name, type: "unblocker" },
      plan: { type: "unblocker", country: "any" },
    },
  ];

  for (const body of payloads) {
    const r = await api("POST", "/zone", body);
    if (r.ok || r.status === 201) return { ok: true, body, response: r.json };
    if (r.status === 409 || /exist/i.test(r.text)) return { ok: true, exists: true, response: r.json };
  }
  return { ok: false };
}

async function listDatasets() {
  for (const path of [
    "/datasets/v3",
    "/datasets",
    "/dca/datasets",
    "/crawl/datasets",
  ]) {
    const r = await api("GET", path);
    if (r.ok && r.json) return { path, data: r.json };
  }
  return null;
}

async function probeUnlocker(zone) {
  const r = await api("POST", "/request?async=false", {
    zone,
    url: "https://geo.brdtest.com/welcome.txt",
    format: "raw",
  });
  return { ok: r.ok, status: r.status, preview: r.text.slice(0, 100) };
}

loadEnv();
let envText = readFileSync(envPath, "utf8");

console.log("Bright Data setup for PGT Vision\n");

const status = await api("GET", "/status");
console.log("Account status:", status.ok ? status.json : status.text);

const zones = await listZones();
console.log("\n--- Zones ---");
if (zones) {
  console.log("Listed via", zones.path);
  console.log(JSON.stringify(zones.data, null, 2).slice(0, 3000));
} else {
  console.log("Could not list zones via API (may need Admin role or CP only).");
}

let zoneName =
  process.env.BRIGHTDATA_WEB_UNLOCKER_ZONE?.trim() ||
  ZONE_NAME;

const existingUnlocker =
  zones?.data &&
  (Array.isArray(zones.data)
    ? zones.data.find((z) => /unlocker|unblocker/i.test(JSON.stringify(z)))
    : null);

if (existingUnlocker?.name) {
  zoneName = existingUnlocker.name;
  console.log("\nUsing existing unlocker-like zone:", zoneName);
} else if (!process.env.BRIGHTDATA_WEB_UNLOCKER_ZONE?.trim()) {
  console.log(`\nCreating Web Unlocker zone "${zoneName}"…`);
  const created = await createUnlockerZone(zoneName);
  if (created.ok) {
    console.log(created.exists ? "Zone already exists." : "Zone created.");
  } else {
    console.log(
      "Zone API create failed — create manually in CP: Web Access APIs → Create API → Web Unlocker API",
    );
    console.log(`Suggested name: ${zoneName}`);
  }
}

const unlockerTest = await probeUnlocker(zoneName);
console.log("\nUnlocker probe:", unlockerTest);

if (unlockerTest.ok) {
  envText = upsertEnv(envText, "BRIGHTDATA_WEB_UNLOCKER_ZONE", zoneName);
} else {
  console.log(
    "\n⚠ Zone not verified — create it in CP first, then re-run: npm run setup:brightdata",
  );
}

const datasets = await listDatasets();
console.log("\n--- Crawl / datasets ---");
let datasetId = process.env.BRIGHTDATA_CRAWL_DATASET_ID?.trim() || "";

if (datasets) {
  console.log("Listed via", datasets.path);
  const blob = JSON.stringify(datasets.data);
  const ids = [...blob.matchAll(/gd_[a-z0-9]+/gi)].map((m) => m[0]);
  const unique = [...new Set(ids)];
  if (unique.length) {
    console.log("Found dataset IDs:", unique.join(", "));
    if (!datasetId) datasetId = unique[0];
  } else {
    console.log(JSON.stringify(datasets.data, null, 2).slice(0, 2000));
  }
} else {
  console.log(
    "No dataset list API — create Crawl API in CP: https://brightdata.com/cp/crawl",
  );
  console.log("Root URL: https://www.psacard.com/ · Output: markdown");
}

if (datasetId) {
  envText = upsertEnv(envText, "BRIGHTDATA_CRAWL_DATASET_ID", datasetId);
  console.log("\nCrawl dataset_id:", datasetId);
}

writeFileSync(envPath, envText, "utf8");
console.log("\nUpdated .env.local");
console.log("  BRIGHTDATA_WEB_UNLOCKER_ZONE =", zoneName);
console.log("  BRIGHTDATA_CRAWL_DATASET_ID  =", datasetId || "(set manually in CP)");
console.log("\nNext: npm run verify:brightdata");
