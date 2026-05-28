/**
 * Validates DB prerequisites + ordering rules for the Japanese artwork live-ticker lane.
 *
 * Usage:
 *   npm run verify:jpn-artwork-ticker
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./load-env-local.mjs";

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const MIN_CONFIDENCE = 0.85;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function countOverlays() {
  const { count, error } = await supabase
    .from("tcg_catalog_localized_artwork")
    .select("id", { count: "exact", head: true })
    .eq("franchise", "pokemon")
    .ilike("language", "japanese")
    .in("artwork_match_status", ["exact_japanese_print", "same_art_confirmed"])
    .gte("match_confidence", MIN_CONFIDENCE);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function sampleOverlays(limit = 500) {
  const { data, error } = await supabase
    .from("tcg_catalog_localized_artwork")
    .select(
      "base_catalog_id,localized_set_name,localized_name,image_small_url,image_large_url,match_confidence,artwork_match_status",
    )
    .eq("franchise", "pokemon")
    .ilike("language", "japanese")
    .in("artwork_match_status", ["exact_japanese_print", "same_art_confirmed"])
    .gte("match_confidence", MIN_CONFIDENCE)
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function loadCards(ids) {
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from("tcg_catalog_cards")
    .select("catalog_id,name,set_name,set_code,prices_json")
    .eq("franchise", "pokemon")
    .in("catalog_id", ids.slice(0, 120));
  if (error) throw new Error(error.message);
  return data ?? [];
}

function bestTcgUsd(pricesJson) {
  const variants = pricesJson?.tcgPlayerPrices;
  if (!Array.isArray(variants)) return null;
  let best = null;
  for (const row of variants) {
    const n = row?.market ?? row?.mid ?? row?.low;
    if (typeof n === "number" && Number.isFinite(n) && (best == null || n > best)) best = n;
  }
  return best;
}

function yearFromSetName(name) {
  const text = String(name ?? "");
  const vintage = [
    ["拡張パック", "1996"],
    ["ポケモンジャングル", "1997"],
    ["化石", "1997"],
    ["ロケット", "1997"],
    ["151", "2023"],
    ["スカーレット", "2023"],
  ];
  for (const [needle, year] of vintage) {
    if (text.includes(needle)) return year;
  }
  return null;
}

async function main() {
  const overlayCount = await countOverlays();
  console.log(`Validated JPN overlay rows (≥${MIN_CONFIDENCE}): ${overlayCount}`);

  if (overlayCount === 0) {
    console.error("\nNo validated Japanese artwork rows.");
    console.error("  npm run db:apply:localized-artwork");
    console.error("  npm run catalog:sync:pokemon-japanese-artwork -- --apply");
    process.exit(1);
  }

  const rows = await sampleOverlays();
  const withImage = rows.filter((r) => r.image_large_url || r.image_small_url).length;
  console.log(`Sample with JPN image URLs: ${withImage}/${rows.length}`);

  const uniqueBase = [...new Set(rows.map((r) => r.base_catalog_id))];
  const cards = await loadCards(uniqueBase);
  const priced = cards.filter((c) => bestTcgUsd(c.prices_json) != null).length;
  console.log(`Sample linked catalog cards with TCGPlayer ref: ${priced}/${cards.length}`);

  const groups = new Map();
  for (const row of rows) {
    const key = row.localized_set_name ?? "unknown";
    if (!groups.has(key)) groups.set(key, { year: yearFromSetName(key), count: 0 });
    groups.get(key).count += 1;
  }

  const sorted = [...groups.entries()].sort((a, b) => {
    const ya = Number(a[1].year ?? 9999);
    const yb = Number(b[1].year ?? 9999);
    return ya - yb;
  });

  if (sorted.length >= 2) {
    console.log(`Set groups in sample: ${sorted.length}`);
    console.log(`  Vintage-ish: ${sorted[0][0]} (${sorted[0][1].year ?? "?"})`);
    console.log(`  Modern-ish: ${sorted[sorted.length - 1][0]} (${sorted[sorted.length - 1][1].year ?? "?"})`);
  }

  if (withImage < Math.min(3, rows.length)) {
    console.error("FAIL: too few overlay rows with image URLs");
    process.exit(1);
  }

  console.log("\nJapanese artwork ticker prerequisites OK.");
  console.log("Refresh live tour: open Liquid Scan → Live Market → refresh, or GET /api/market/live-ticker?refresh=1");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
