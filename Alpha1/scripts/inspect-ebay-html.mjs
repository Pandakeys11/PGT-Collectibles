import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

function loadEnv() {
  const env = {};
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    if (!line.includes("=") || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[line.slice(0, i).trim()] = v;
  }
  return env;
}

const env = loadEnv();
const url =
  "https://www.ebay.com/sch/i.html?_nkw=Pokemon+Charizard+PSA+9&LH_Sold=1&LH_Complete=1&_sacat=2536";

const res = await fetch("https://api.brightdata.com/request?async=false", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${env.BRIGHTDATA_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    zone: env.BRIGHTDATA_WEB_UNLOCKER_ZONE,
    url,
    format: "raw",
    country: "us",
    render: true,
  }),
  signal: AbortSignal.timeout(120_000),
});

let html = await res.text();
if (html.trim().startsWith("{")) {
  try {
    const j = JSON.parse(html);
    html = j.body || j.response || html;
  } catch {
    /* */
  }
}

const out = join(".cache", "brightdata-ebay", "inspect.html");
mkdirSync(join(".cache", "brightdata-ebay"), { recursive: true });
writeFileSync(out, html, "utf8");

console.log("status", res.status, "brd", res.headers.get("x-brd-status-code"), "bytes", html.length);
console.log("/itm/", (html.match(/\/itm\//g) ?? []).length);

const titleRe = /"title":\{"_type":"TextSpan","text":"([^"]{8,120})"/g;
const titles = [];
let m;
while ((m = titleRe.exec(html)) && titles.length < 5) titles.push(m[1]);
console.log("embedded titles", titles);

const cardRe = /class="[^"]*s-card[^"]*"[\s\S]{0,5000}?href="(https?:\/\/ebay\.com\/itm\/[^"]+)"/i;
const card = cardRe.exec(html);
if (card) {
  console.log("\n--- first s-card snippet ---");
  console.log(card[0].slice(0, 1200));
}

const cardCount = (html.match(/s-card__link/g) ?? []).length;
console.log("s-card__link count", cardCount);
