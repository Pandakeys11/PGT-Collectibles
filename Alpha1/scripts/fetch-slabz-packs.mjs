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

const key = process.env.SLABZ_API_KEY?.trim();
const base = (
  process.env.SLABZ_API_BASE_URL?.trim() ||
  "https://api-staging-3e2d.up.railway.app/api/partner/v1"
).replace(/\/$/, "");

const res = await fetch(`${base}/packs`, {
  headers: { Accept: "application/json", "X-API-Key": key },
});
const json = await res.json();
console.log(JSON.stringify(json, null, 2));
