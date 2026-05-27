/**
 * Materialize important Pokemon print/finish variants as first-class master catalog rows.
 *
 * Current coverage:
 *   - Printing variants from src/data/pokedex/catalog-set-overlays.json
 *   - Legendary Collection Reverse Holo: base6-*__reverse_holo
 *
 * Usage:
 *   node scripts/sync-pokemon-catalog-variants.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./load-env-local.mjs";

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const overlayPath = path.join(process.cwd(), "src", "data", "pokedex", "catalog-set-overlays.json");

const TCGPLAYER_UNLIMITED_PRODUCT_BASE = {
  base1: 42378,
  base2: 42443,
  base3: 42508,
};

const VARIANT_LABELS = {
  unlimited: "Unlimited",
  first_edition: "1st Edition",
  shadowless: "Shadowless",
  reverse_holo: "Reverse Holo",
};

function searchText(parts) {
  return parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s/.-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function loadMergedVariantArtwork() {
  const rawPath = process.env.CATALOG_VARIANT_ARTWORK_MERGED_PATH?.trim();
  if (!rawPath) return null;
  const abs = path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath);
  if (!existsSync(abs)) return null;
  return JSON.parse(readFileSync(abs, "utf8"));
}

function variantUrls(merged, setId, catalogId, key) {
  const row = merged?.sets?.[setId]?.[catalogId]?.[key];
  if (!row?.small && !row?.large) return null;
  return {
    small: row.small ?? row.large ?? null,
    large: row.large ?? row.small ?? null,
  };
}

function tcgplayerImageUrl(productId) {
  const u = `https://product-images.tcgplayer.com/fit-in/437x437/${productId}.jpg`;
  return { small: u, large: u };
}

function base1UnlimitedUrls(row, merged) {
  const mergedUrls = variantUrls(merged, "base1", row.catalog_id, "unlimited");
  const number = Number.parseInt(String(row.card_number ?? ""), 10);
  if (Number.isFinite(number)) {
    return { ...tcgplayerImageUrl(42378 + number), source: "tcgplayer_conventional" };
  }
  if (mergedUrls) return { ...mergedUrls, source: "merged_manifest" };
  return {
    small: row.image_small_url,
    large: row.image_large_url ?? row.image_small_url,
    source: "base_row",
  };
}

function printingVariantUrls(row, merged, variantKey) {
  const setId = String(row.set_code ?? "");
  const mergedUrls = variantUrls(merged, setId, row.catalog_id, variantKey);
  if (variantKey === "unlimited") {
    const productIdBase = TCGPLAYER_UNLIMITED_PRODUCT_BASE[setId];
    const number = Number.parseInt(String(row.card_number ?? ""), 10);
    if (productIdBase && Number.isFinite(number)) {
      return { ...tcgplayerImageUrl(productIdBase + number), source: "tcgplayer_conventional" };
    }
  }
  if (setId === "base1" && variantKey === "unlimited") {
    return base1UnlimitedUrls(row, merged);
  }
  if (mergedUrls) return { ...mergedUrls, source: "merged_manifest" };
  return {
    small: row.image_small_url,
    large: row.image_large_url ?? row.image_small_url,
    source: "base_row",
  };
}

function rowWithVariant(row, variant) {
  const label = variant.label;
  const images = variant.images;
  const raw = row.raw_json && typeof row.raw_json === "object" ? row.raw_json : {};
  return {
    franchise: "pokemon",
    catalog_id: `${row.catalog_id}__${variant.key}`,
    name: `${row.name} (${label})`,
    printed_name: row.printed_name ?? row.name,
    set_name: row.set_name,
    set_code: row.set_code,
    card_number: row.card_number,
    year: row.year,
    rarity: variant.rarity ?? row.rarity,
    image_small_url: images.small ?? row.image_small_url,
    image_large_url: images.large ?? images.small ?? row.image_large_url,
    search_text: searchText([
      row.name,
      label,
      variant.key,
      row.set_name,
      row.set_code,
      row.card_number,
      row.year,
      row.rarity,
    ]),
    prices_json: row.prices_json ?? {},
    raw_json: {
      ...raw,
      pokemonId: raw.pokemonId ?? row.catalog_id,
      sourceCatalogId: row.catalog_id,
      catalogVariantKey: variant.key,
      variantLabel: label,
      variantKind: variant.kind,
      syntheticVariant: true,
      imageSource: images.source,
    },
    source_id: row.source_id ?? "pokemontcg.io",
    synced_at: new Date().toISOString(),
  };
}

async function fetchBaseRows(setCode) {
  const rows = [];
  let from = 0;
  const pageSize = 500;
  for (;;) {
    const { data, error } = await supabase
      .from("tcg_catalog_cards")
      .select(
        "catalog_id,name,printed_name,set_name,set_code,card_number,year,rarity,image_small_url,image_large_url,prices_json,raw_json,source_id",
      )
      .eq("franchise", "pokemon")
      .eq("set_code", setCode)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const batch = (data ?? []).filter((row) => !String(row.catalog_id).includes("__"));
    rows.push(...batch);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

async function upsertRows(rows) {
  let total = 0;
  const chunkSize = 200;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from("tcg_catalog_cards").upsert(chunk, {
      onConflict: "franchise,catalog_id",
    });
    if (error) throw new Error(error.message);
    total += chunk.length;
  }
  return total;
}

function loadPrintingVariantSpecs() {
  if (!existsSync(overlayPath)) return [];
  const overlay = JSON.parse(readFileSync(overlayPath, "utf8"));
  const specs = [];
  for (const set of overlay.sets ?? []) {
    const setId = String(set.setId ?? "").trim();
    if (!setId) continue;
    for (const variant of set.printingVariants ?? []) {
      const key = String(variant.id ?? "").trim();
      if (!key || key === "catalog") continue;
      if (!["unlimited", "first_edition", "shadowless"].includes(key)) continue;
      specs.push({
        setId,
        key,
        label: String(variant.label ?? VARIANT_LABELS[key] ?? key),
      });
    }
  }
  return specs;
}

async function syncPrintingVariant(merged, spec) {
  const rows = await fetchBaseRows(spec.setId);
  const variants = rows.map((row) =>
    rowWithVariant(row, {
      key: spec.key,
      label: spec.label,
      kind: "print_run",
      images: printingVariantUrls(row, merged, spec.key),
    }),
  );
  return upsertRows(variants);
}

async function syncLegendaryCollectionReverse(merged) {
  const rows = await fetchBaseRows("base6");
  const variants = rows.map((row) => {
    const mergedUrls = variantUrls(merged, "base6", row.catalog_id, "reverse_holo");
    return rowWithVariant(row, {
      key: "reverse_holo",
      label: "Reverse Holo",
      kind: "finish",
      rarity: "Reverse Holo",
      images: mergedUrls
        ? { ...mergedUrls, source: "merged_manifest" }
        : {
            small: row.image_small_url,
            large: row.image_large_url ?? row.image_small_url,
            source: "base_row",
          },
    });
  });
  return upsertRows(variants);
}

async function main() {
  console.log("Pokemon catalog variant materialization\n");
  const merged = loadMergedVariantArtwork();
  console.log(`  merged artwork: ${merged ? "loaded" : "not found"}`);

  const specs = loadPrintingVariantSpecs();
  let printRows = 0;
  for (const spec of specs) {
    const count = await syncPrintingVariant(merged, spec);
    printRows += count;
    console.log(`  ${spec.setId} ${spec.label} rows: ${count}`);
  }

  const lcReverse = await syncLegendaryCollectionReverse(merged);
  console.log(`  Legendary Collection Reverse Holo rows: ${lcReverse}`);
  console.log(`  Print variant rows total: ${printRows}`);

  console.log("\nPokemon catalog variants synced.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
