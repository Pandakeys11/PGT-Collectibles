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

const env = loadEnvLocal();
const key = env.POKETRACE_API_KEY;
const base = (env.POKETRACE_BASE_URL || "https://api.poketrace.com/v1").replace(
  /\/$/,
  "",
);
if (!key) {
  console.error("POKETRACE_API_KEY missing — add to .env.local");
  process.exit(1);
}

const headers = { "X-API-Key": key, Accept: "application/json" };

const searchRes = await fetch(`${base}/cards?search=charizard&market=US&limit=1`, {
  headers,
});
const searchJson = await searchRes.json();
console.log("search", searchRes.status, "count", searchJson.data?.length ?? 0);
const card = searchJson.data?.[0];
if (!card) {
  console.log("no card");
  process.exit(0);
}

console.log("card", card.id, card.name);
const sources = Object.keys(card.prices ?? {});
console.log("sources:", sources.join(", "));

const tier =
  Object.keys(card.prices?.ebay ?? {}).find((t) => card.prices.ebay[t]?.avg != null) ??
  Object.keys(card.prices?.tcgplayer ?? {})[0] ??
  "NEAR_MINT";

const histRes = await fetch(
  `${base}/cards/${encodeURIComponent(card.id)}/prices/${encodeURIComponent(tier)}/history?period=30d&limit=10`,
  { headers },
);
const histJson = await histRes.json();
const points = histJson.data?.length ?? 0;
console.log("history", histRes.status, tier, "points", points);
if (points >= 2) {
  const first = histJson.data[0];
  const last = histJson.data[points - 1];
  console.log("  range", first.date, "→", last.date, "avg", first.avg, "→", last.avg);
}

console.log("ok");
