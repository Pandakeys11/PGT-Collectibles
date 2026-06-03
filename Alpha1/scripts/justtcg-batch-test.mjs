import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
for (const name of [".env.local", ".env"]) {
  const p = resolve(root, name);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m || process.env[m[1]]) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const k = process.env.JUSTTCG_API_KEY?.trim();
const base = (process.env.JUSTTCG_BASE_URL || "https://api.justtcg.com/v1").replace(/\/$/, "");

const items = [
  { game: "pokemon", number: "125", query: "Mega Charizard X ex", set: "me2" },
  { game: "pokemon", number: "130", query: "Mega Charizard X ex" },
];

const url = `${base}/cards?include_statistics=7d%2C30d&include_price_history=false`;
let res = await fetch(url, {
  method: "POST",
  headers: { Accept: "application/json", "Content-Type": "application/json", "x-api-key": k },
  body: JSON.stringify(items),
});
let body = await res.json();
console.log("POST status", res.status, JSON.stringify(body).slice(0, 400));

const getUrl = `${base}/cards?tcgplayerId=654527&game=pokemon&include_statistics=7d,30d&include_price_history=false`;
res = await fetch(getUrl, { headers: { "x-api-key": k } });
body = await res.json();
console.log("GET status", res.status, "count", body.data?.length);
for (const c of body.data ?? []) {
  const v = c.variants?.[0];
  console.log(c.name, c.number, "| 7d%", v?.priceChange7d, "| avg", v?.avgPrice, "30d", v?.avgPrice30d);
}

const searchUrl = `${base}/cards?game=pokemon&search=${encodeURIComponent("Mega Charizard X ex")}&limit=5&include_statistics=7d,30d&include_price_history=false`;
const sres = await fetch(searchUrl, { headers: { "x-api-key": k } });
const sbody = await sres.json();
console.log("search n=", sbody.data?.length);
for (const c of sbody.data ?? []) {
  const v = c.variants?.[0];
  console.log(" ", c.name, c.number, c.set_name, v?.priceChange7d, v?.avgPrice, v?.avgPrice30d);
}
