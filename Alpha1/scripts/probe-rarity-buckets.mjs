/**
 * Probe rarity bucket counts for a Pokémon set in Supabase cache.
 * Usage: node scripts/probe-rarity-buckets.mjs base1
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./load-env-local.mjs";

loadEnvLocal();

const setId = process.argv[2]?.trim() || "base1";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error("Missing Supabase env");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const BASE = ["Common", "Uncommon", "Common Reverse Holo", "Uncommon Reverse Holo"];
const RARE = [
  "Rare",
  "Rare Holo",
  "Rare Holo EX",
  "Rare Holo Cosmos",
  "Rare Prime",
  "Rare BREAK",
  "Rare ACE",
  "Rare Shining",
  "Rare Shining Neo",
  "Rare Reverse Holo",
];
const ULTRA = [
  "Rare Ultra",
  "Ultra Rare",
  "Double Rare",
  "Illustration Rare",
  "Amazing Rare",
  "Radiant Rare",
  "ACE SPEC Rare",
  "Shiny Rare",
  "Rare Shiny",
  "Rare Holo V",
  "Rare Holo VMAX",
  "Rare Holo VSTAR",
  "Rare Holo LV.X",
  "Rare Holo Star",
  "Rare Holo Lv.X",
  "Rare Prism Star",
  "Rare GX",
  "Rare TAG TEAM",
];
const SECRET = [
  "Secret Rare",
  "Hyper Rare",
  "Special Illustration Rare",
  "Rare Secret",
  "Rare Rainbow",
  "Rare Shiny GX",
  "Rare Secret GX",
];

function norm(s) {
  return String(s ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function matchesTerm(rarity, term) {
  const r = norm(rarity);
  const t = norm(term);
  if (!r || !t) return false;
  if (t === "Rare") return r === "Rare";
  return r.localeCompare(t, undefined, { sensitivity: "accent" }) === 0;
}

function inferBucket(rarity) {
  if (!norm(rarity)) return null;
  for (const [bucket, terms] of [
    ["secret", SECRET],
    ["ultra", ULTRA],
    ["rare", RARE],
    ["base", BASE],
  ]) {
    for (const term of terms) {
      if (matchesTerm(rarity, term)) return bucket;
    }
  }
  return null;
}

function rarityFromRow(row) {
  if (row.rarity?.trim()) return row.rarity.trim();
  const raw = row.raw_json ?? {};
  if (typeof raw.rarity === "string" && raw.rarity.trim()) return raw.rarity.trim();
  return null;
}

async function loadSet(setCode) {
  const { data: setRow } = await supabase
    .from("tcg_catalog_sets")
    .select("external_set_id,name,code")
    .eq("franchise", "pokemon")
    .or(`external_set_id.eq.${setCode},code.eq.${setCode}`)
    .maybeSingle();

  const filters = [];
  if (setRow?.code) filters.push({ col: "set_code", val: setRow.code });
  if (setRow?.name) filters.push({ col: "set_name", val: setRow.name });

  let rows = [];
  for (const f of filters.length ? filters : [{ col: "set_code", val: setCode }]) {
    const { data, error } = await supabase
      .from("tcg_catalog_cards")
      .select("catalog_id,rarity,raw_json")
      .eq("franchise", "pokemon")
      .eq(f.col, f.val)
      .limit(3000);
    if (error) throw new Error(error.message);
    if (data?.length) {
      rows = data;
      break;
    }
  }
  return { setRow, rows };
}

const { setRow, rows } = await loadSet(setId);
console.log(`Set ${setId}`, setRow ?? "(no set row)");
console.log(`Rows: ${rows.length}`);

const counts = { all: 0, base: 0, rare: 0, ultra: 0, secret: 0, nullRarity: 0, unmapped: 0 };
const unmappedSamples = new Map();
const nullCol = { column: 0, rawJson: 0 };

for (const row of rows) {
  counts.all += 1;
  const col = row.rarity?.trim() || null;
  const fromRaw = rarityFromRow(row);
  const r = fromRaw;
  if (!col && fromRaw) nullCol.rawJson += 1;
  if (!r) {
    counts.nullRarity += 1;
    continue;
  }
  const bucket = inferBucket(r);
  if (bucket) counts[bucket] += 1;
  else {
    counts.unmapped += 1;
    unmappedSamples.set(r, (unmappedSamples.get(r) ?? 0) + 1);
  }
}

console.log("Counts:", counts);
console.log("Rarity only in raw_json:", nullCol.rawJson);
if (unmappedSamples.size) {
  console.log("Unmapped rarities:");
  for (const [k, v] of [...unmappedSamples.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`  ${v}x ${k}`);
  }
}
