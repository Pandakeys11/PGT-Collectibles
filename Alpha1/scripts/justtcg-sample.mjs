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
if (!k) {
  console.log("No JUSTTCG_API_KEY");
  process.exit(0);
}

const tries = [
  "game=pokemon&set=me2&orderBy=7d&order=desc&limit=5",
  "game=pokemon&set=phantasmal-flames&orderBy=7d&order=desc&limit=5",
  "game=pokemon&orderBy=7d&order=desc&limit=5",
];
for (const q of tries) {
  const url = `https://api.justtcg.com/v1/cards?${q}&include_statistics=7d,30d&include_price_history=false`;
  const res = await fetch(url, { headers: { "x-api-key": k } });
  const body = await res.json();
  console.log(q, "->", res.status, "n=", body.data?.length, body.data?.[0]?.name, body.data?.[0]?.variants?.[0]?.priceChange7d);
}
process.exit(0);
const url =
  "https://api.justtcg.com/v1/cards?game=pokemon&orderBy=7d&order=desc&limit=2&include_statistics=7d,30d&include_price_history=false";
const res = await fetch(url, { headers: { "x-api-key": k } });
const body = await res.json();
console.log("status", res.status);
const card = body.data?.[0];
console.log("card keys", card ? Object.keys(card) : null);
const v = card?.variants?.[0];
console.log("variant keys", v ? Object.keys(v) : null);
console.log(JSON.stringify({ card: card?.name, variant: v }, null, 2).slice(0, 3000));
