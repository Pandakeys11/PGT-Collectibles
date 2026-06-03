/**
 * Verify vintage WOTC print-run catalog rows + distinct Base Set artwork.
 * Usage: npm run verify:vintage-print-match
 */
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

const EXPECTED_VARIANT_SETS = [
  { code: "base1", variants: ["first_edition", "shadowless", "unlimited"], base: 102 },
  { code: "base5", variants: ["first_edition", "unlimited"], base: 83 },
  { code: "gym2", variants: ["first_edition", "unlimited"], base: 132 },
  { code: "neo1", variants: ["first_edition", "unlimited"], base: 111 },
  { code: "base6", variants: ["reverse_holo"], base: 110 },
];

const GRID_EXPECTATIONS = [
  {
    label: "Base Charizard 1st Edition Shadowless",
    catalogId: "base1-4__first_edition",
    distinctFrom: ["base1-4__unlimited"],
  },
  {
    label: "Base Charizard Shadowless Unlimited",
    catalogId: "base1-4__shadowless",
    distinctFrom: ["base1-4__unlimited", "base1-4"],
  },
  {
    label: "Base Charizard Unlimited shadowed",
    catalogId: "base1-4__unlimited",
    distinctFrom: ["base1-4__shadowless"],
  },
  {
    label: "Team Rocket Dark Charizard 1st",
    catalogId: "base5-4__first_edition",
  },
  {
    label: "Team Rocket Dark Charizard Unlimited",
    catalogId: "base5-4__unlimited",
  },
  {
    label: "Gym Challenge Blaine's Charizard 1st",
    catalogId: "gym2-2__first_edition",
  },
  {
    label: "Neo Genesis Lugia 1st",
    catalogId: "neo1-9__first_edition",
  },
  {
    label: "LC reverse holo sample",
    catalogId: "base6-3__reverse_holo",
    distinctFrom: ["base6-3"],
  },
];

async function variantCount(setCode, variantKey) {
  const { count, error } = await supabase
    .from("tcg_catalog_cards")
    .select("id", { count: "exact", head: true })
    .eq("franchise", "pokemon")
    .eq("set_code", setCode)
    .eq("raw_json->>catalogVariantKey", variantKey);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function baseCount(setCode) {
  const { data, error } = await supabase
    .from("tcg_catalog_cards")
    .select("catalog_id")
    .eq("franchise", "pokemon")
    .eq("set_code", setCode);
  if (error) throw new Error(error.message);
  return (data ?? []).filter((row) => !String(row.catalog_id).includes("__")).length;
}

async function main() {
  console.log("Vintage print-run catalog audit\n");
  let ok = true;

  for (const spec of EXPECTED_VARIANT_SETS) {
    const base = await baseCount(spec.code);
    if (base !== spec.base) {
      console.error(`  FAIL ${spec.code} base rows: ${base} (expected ${spec.base})`);
      ok = false;
      continue;
    }
    for (const variant of spec.variants) {
      const count = await variantCount(spec.code, variant);
      if (count !== spec.base) {
        console.error(`  FAIL ${spec.code} ${variant}: ${count} (expected ${spec.base})`);
        ok = false;
      } else {
        console.log(`  OK  ${spec.code} ${variant}: ${count}`);
      }
    }
  }

  const ids = [
    ...GRID_EXPECTATIONS.map((row) => row.catalogId),
    ...GRID_EXPECTATIONS.flatMap((row) => row.distinctFrom ?? []),
    "base1-4",
  ];
  const uniqueIds = [...new Set(ids)];

  const { data, error } = await supabase
    .from("tcg_catalog_cards")
    .select("catalog_id,name,set_name,image_large_url,raw_json")
    .eq("franchise", "pokemon")
    .in("catalog_id", uniqueIds);
  if (error) throw new Error(error.message);

  const byId = new Map((data ?? []).map((row) => [row.catalog_id, row]));

  console.log("\nGrid test-image catalog rows:");
  for (const spec of GRID_EXPECTATIONS) {
    const row = byId.get(spec.catalogId);
    if (!row?.image_large_url) {
      console.error(`  FAIL ${spec.label}: missing row ${spec.catalogId}`);
      ok = false;
      continue;
    }
    let distinctOk = true;
    for (const otherId of spec.distinctFrom ?? []) {
      const other = byId.get(otherId);
      if (other?.image_large_url && other.image_large_url === row.image_large_url) {
        console.error(
          `  FAIL ${spec.label}: same image as ${otherId} (${row.image_large_url.slice(0, 60)}…)`,
        );
        distinctOk = false;
        ok = false;
      }
    }
    if (distinctOk) {
      console.log(
        `  OK  ${spec.label} → ${spec.catalogId} (${row.raw_json?.imageSource ?? "api"})`,
      );
    }
  }

  if (!ok) process.exit(1);
  console.log("\nVintage print-run catalog audit passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
