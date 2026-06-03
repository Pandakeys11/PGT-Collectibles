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

const id = process.argv[2] || "me2-125";
const { getCardFromDb } = await import("../src/lib/catalog/db-catalog-browse.ts");
const row = await getCardFromDb("pokemon", id);
console.log(id, row?.name, JSON.stringify(row?.prices, null, 2).slice(0, 1200));
