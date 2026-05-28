/**
 * eBay sold comps smoke — Apify → Finding → HTML (reads .env.local).
 * Usage: npm run verify:ebay-sold
 */
import fs from "node:fs";
import path from "node:path";

function loadEnvLocal() {
  const file = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

function resolveFindingAppId(env) {
  const dedicated = env.EBAY_FINDING_APP_ID?.trim();
  if (dedicated) return dedicated;
  const sandbox =
    env.EBAY_API_ENV?.toLowerCase() === "sandbox" ||
    env.EBAY_USE_SANDBOX === "1" ||
    env.EBAY_USE_SANDBOX?.toLowerCase() === "true";
  if (sandbox) return "";
  return env.EBAY_CLIENT_ID?.trim() || env.EBAY_APP_ID?.trim() || "";
}

function buildCompletedUrl(keyword) {
  const q = encodeURIComponent(
    keyword.replace(/[^\w\s-]/g, " ").replace(/\s+/g, " ").trim(),
  );
  return `https://www.ebay.com/sch/i.html?_nkw=${q}&LH_Complete=1&LH_Sold=1&_sacat=2536&_ipg=60`;
}

const env = loadEnvLocal();
const apifyToken = env.APIFY_API_TOKEN?.trim();
const findingAppId = resolveFindingAppId(env);
const bdKey = env.BRIGHTDATA_API_KEY?.trim();
const bdZone = env.BRIGHTDATA_WEB_UNLOCKER_ZONE?.trim();
const keyword = "Pokemon Charizard Base Set 4 PSA 9";

console.log("eBay sold smoke");
console.log("  APIFY token:", apifyToken ? "set" : "missing");
console.log("  Finding App ID:", findingAppId ? `${findingAppId.slice(0, 8)}…` : "missing");
console.log("  query:", keyword);

let apifyCount = 0;
let findingCount = 0;
let htmlCount = 0;
let htmlBlocked = false;

if (apifyToken && env.EBAY_SOLD_APIFY !== "0") {
  const actor = (env.APIFY_EBAY_SOLD_ACTOR || "caffein.dev/ebay-sold-listings").replace(
    "/",
    "~",
  );
  const timeout = Number(env.APIFY_EBAY_SOLD_TIMEOUT_SEC ?? 90) || 90;
  const url = `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?timeout=${timeout}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apifyToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      keywords: [keyword],
      daysToScrape: 90,
      count: 12,
      ebaySite: "ebay.com",
      sortOrder: "endedRecently",
      subcategoryId: "2536",
    }),
    signal: AbortSignal.timeout((timeout + 25) * 1000),
  });
  const body = await res.json().catch(() => []);
  apifyCount = Array.isArray(body) ? body.length : 0;
  console.log("\nApify:", res.status, "rows", apifyCount);
  if (!apifyCount && body?.error?.message) {
    console.log("  error:", body.error.message);
    if (/usage hard limit/i.test(body.error.message)) {
      console.log("  hint: Apify monthly quota exhausted — reset billing or use HTML/Finding fallbacks");
    }
  }
  if (apifyCount > 0) {
    const row = body[0];
    console.log(
      "  sample:",
      row.title?.slice?.(0, 50) ?? row.name,
      row.soldPrice ?? row.price ?? row.totalPrice,
    );
  }
} else {
  console.log("\nApify: skipped");
}

if (findingAppId && env.EBAY_DISABLE_FINDING !== "1") {
  const q = keyword.replace(/[^\w\s-]/g, " ").replace(/\s+/g, " ").trim();
  const parts = [
    "OPERATION-NAME=findCompletedItems",
    "SERVICE-VERSION=1.0.0",
    `SECURITY-APPNAME=${encodeURIComponent(findingAppId)}`,
    "RESPONSE-DATA-FORMAT=JSON",
    `keywords=${encodeURIComponent(q)}`,
    "itemFilter(0).name=SoldItemsOnly",
    "itemFilter(0).value=true",
    "sortOrder=EndTimeLatest",
    "paginationInput.entriesPerPage=12",
    "categoryId=2536",
  ];
  const res = await fetch(
    `https://svcs.ebay.com/services/search/FindingService/v1?${parts.join("&")}`,
    { signal: AbortSignal.timeout(20_000) },
  );
  const json = await res.json().catch(() => ({}));
  const items =
    json?.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item ?? [];
  findingCount = Array.isArray(items) ? items.length : 0;
  console.log("\nFinding:", res.status, "items", findingCount);
  if (findingCount === 0 && json?.errorMessage) {
    console.log("  error:", JSON.stringify(json.errorMessage).slice(0, 220));
    console.log(
      "  hint: set EBAY_FINDING_APP_ID to your Production App ID (not EBAY_DEV_ID developer id)",
    );
  }
} else {
  console.log("\nFinding: skipped");
}

{
  const url = buildCompletedUrl(keyword);
  let html = "";
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(18_000),
  });
  html = res.ok ? await res.text() : "";
  let via = "direct";
  htmlBlocked =
    !res.ok ||
    res.status === 403 ||
    /captcha|robot check|verify you are a human|just a moment/i.test(html) ||
    html.length < 2000;

  if (htmlBlocked && bdKey && bdZone && env.EBAY_SOLD_BRIGHTDATA !== "0") {
    const unlock = await fetch("https://api.brightdata.com/request?async=false", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${bdKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ zone: bdZone, url, format: "raw", country: "us" }),
      signal: AbortSignal.timeout(90_000),
    });
    let unlocked = await unlock.text();
    if (unlock.ok && unlocked.trim().startsWith("{")) {
      try {
        const json = JSON.parse(unlocked);
        unlocked =
          (typeof json.body === "string" && json.body) ||
          (typeof json.response === "string" && json.response) ||
          (typeof json.content === "string" && json.content) ||
          unlocked;
      } catch {
        /* keep raw */
      }
    }
    if (unlock.ok && unlocked.length > 2000) {
      html = unlocked;
      via = "brightdata";
      htmlBlocked = /captcha|just a moment/i.test(html);
    } else {
      console.log(
        "\nBright Data unlocker:",
        unlock.status,
        "bytes",
        unlocked.length,
        unlocked.slice(0, 120),
      );
    }
  }

  const items = html.match(/class="[^"]*\bs-item\b/gi) ?? [];
  htmlCount = items.length;
  console.log(
    "\nHTML completed:",
    res.status,
    "via",
    via,
    "s-item blocks",
    htmlCount,
    htmlBlocked ? "(blocked?)" : "",
  );
}

const soldReady =
  (apifyToken && env.EBAY_SOLD_APIFY !== "0" && apifyCount > 0) ||
  (findingAppId && env.EBAY_DISABLE_FINDING !== "1" && findingCount > 0) ||
  (bdKey && bdZone && env.EBAY_SOLD_BRIGHTDATA !== "0" && htmlCount > 3);

console.log("\nProduction ready (sold pipeline):", soldReady ? "yes" : "no");
if (apifyToken && apifyCount === 0) {
  console.log("  Apify: credentials set but not returning rows (quota or actor)");
}
if (findingAppId && findingCount === 0) {
  console.log("  Finding: App ID set but 0 items (rate limit or query)");
}
if (bdKey && bdZone && htmlCount <= 3) {
  console.log("  HTML: Bright Data configured but no listing blocks parsed");
}

const any = apifyCount > 0 || findingCount > 0 || htmlCount > 3;
if (!any) {
  console.error("\nNo sold data from any source — fix quotas/credentials above.");
  process.exit(1);
}

console.log("\nok — at least one source returned sold rows in this smoke test");
