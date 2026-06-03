#!/usr/bin/env node
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

const key = process.env.POKETRACE_API_KEY?.trim();
const base = (process.env.POKETRACE_BASE_URL || "https://api.poketrace.com/v1").replace(/\/$/, "");
if (!key) {
  console.error("No POKETRACE_API_KEY");
  process.exit(1);
}

const headers = { Accept: "application/json", "X-API-Key": key };

async function get(path, params = {}) {
  const url = new URL(`${base}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers });
  const text = await res.text();
  console.log(path, res.status, text.slice(0, 800));
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

await get("/cards", {
  search: "Mega Charizard X ex",
  card_number: "125",
  game: "pokemon",
  market: "US",
  product_type: "single",
  limit: "5",
});
