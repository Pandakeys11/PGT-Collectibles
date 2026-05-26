import { readFileSync } from "fs";
import { resolve } from "path";

function loadKey() {
  try {
    const env = readFileSync(resolve("Alpha1/.env.local"), "utf8");
    const m = env.match(/^POKEMON_TCG_API_KEY=(.+)$/m);
    return m?.[1]?.trim();
  } catch {
    return process.env.POKEMON_TCG_API_KEY?.trim();
  }
}

const key = loadKey();
const h = { Accept: "application/json" };
if (key) h["X-Api-Key"] = key;

async function probe(label, q) {
  const u = `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&pageSize=1`;
  const r = await fetch(u, { headers: h, signal: AbortSignal.timeout(30000) });
  const t = await r.text();
  console.log(`\n[${label}] status=${r.status}`);
  if (!r.ok) console.log(t.slice(0, 300));
  else {
    const j = JSON.parse(t);
    console.log("totalCount=", j.totalCount);
  }
}

const secretInner = [
  'rarity:"Secret Rare"',
  "rarity:Hyper",
  'rarity:"Special Illustration Rare"',
  'rarity:"Rare Secret"',
  'rarity:"Rare Rainbow"',
  'rarity:"Rare Shiny GX"',
  'rarity:"Rare Secret GX"',
].join(" OR ");

const setsRes = await fetch(
  "https://api.pokemontcg.io/v2/sets?q=name:Ascended&pageSize=10&orderBy=-releaseDate",
  { headers: h, signal: AbortSignal.timeout(30000) },
);
const setsJson = await setsRes.json();
console.log(
  "sets:",
  setsJson.data?.map((s) => ({ id: s.id, name: s.name, total: s.total, date: s.releaseDate })),
);
const setId = setsJson.data?.find((s) => /ascended/i.test(s.name))?.id;
if (!setId) {
  console.error("no set id");
  process.exit(1);
}

await probe("all", `set.id:${setId}`);
await probe("secret full", `set.id:${setId} AND (${secretInner})`);
await probe("secret short", `set.id:${setId} AND rarity:"Secret Rare"`);
