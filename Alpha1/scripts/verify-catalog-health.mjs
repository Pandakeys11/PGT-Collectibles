/**
 * Verify the local master catalog DB has the core coverage Liquid Scan depends on.
 * Usage: npm run verify:catalog-health
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
const today = new Date().toISOString().slice(0, 10);

async function check(name, fn) {
  try {
    await fn();
    console.log(`  OK  ${name}`);
    return true;
  } catch (e) {
    console.error(`  FAIL ${name}: ${e instanceof Error ? e.message : e}`);
    return false;
  }
}

async function exactCount(table, filters) {
  let query = supabase.from(table).select("id", { count: "exact", head: true });
  for (const [column, value] of Object.entries(filters)) {
    query = query.eq(column, value);
  }
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function pokemonSetBaseCount(setCode) {
  const { data, error } = await supabase
    .from("tcg_catalog_cards")
    .select("catalog_id")
    .eq("franchise", "pokemon")
    .eq("set_code", setCode);
  if (error) throw new Error(error.message);
  return (data ?? []).filter((row) => !String(row.catalog_id).includes("__")).length;
}

async function pokemonVariantCount(setCode, variantKey) {
  const { count, error } = await supabase
    .from("tcg_catalog_cards")
    .select("id", { count: "exact", head: true })
    .eq("franchise", "pokemon")
    .eq("set_code", setCode)
    .eq("raw_json->>catalogVariantKey", variantKey);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function expectCountAtLeast(label, table, filters, minimum) {
  const count = await exactCount(table, filters);
  if (count < minimum) {
    throw new Error(`${label} has ${count}, expected at least ${minimum}`);
  }
  return count;
}

async function main() {
  console.log("Master catalog DB health\n");
  let ok = true;

  const minimums = {
    pokemon: { sets: 100, cards: 10000 },
    magic: { sets: 100, cards: 25000 },
    yugioh: { sets: 100, cards: 10000 },
    onepiece: { sets: 10, cards: 1000 },
    lorcana: { sets: 10, cards: 1000 },
  };

  for (const [franchise, target] of Object.entries(minimums)) {
    ok &&= await check(`${franchise} catalog coverage`, async () => {
      const setCount = await expectCountAtLeast(
        `${franchise} sets`,
        "tcg_catalog_sets",
        { franchise },
        target.sets,
      );
      const cardCount = await expectCountAtLeast(
        `${franchise} cards`,
        "tcg_catalog_cards",
        { franchise },
        target.cards,
      );
      console.log(`      ${setCount.toLocaleString()} sets / ${cardCount.toLocaleString()} cards`);
    });
  }

  ok &&= await check("pokemon vintage anchor sets", async () => {
    const baseCount = await pokemonSetBaseCount("base1");
    const southernIslandsCount = await pokemonSetBaseCount("si1");
    if (baseCount !== 102) throw new Error(`Base Set has ${baseCount}, expected 102`);
    if (southernIslandsCount !== 18) {
      throw new Error(`Southern Islands has ${southernIslandsCount}, expected 18`);
    }
  });

  ok &&= await check("pokemon variant rows", async () => {
    const baseUnlimited = await pokemonVariantCount("base1", "unlimited");
    const lcReverse = await pokemonVariantCount("base6", "reverse_holo");
    if (baseUnlimited !== 102) {
      throw new Error(`Base Set Unlimited has ${baseUnlimited}, expected 102`);
    }
    if (lcReverse !== 110) {
      throw new Error(`Legendary Collection reverse holo has ${lcReverse}, expected 110`);
    }

    const { data, error } = await supabase
      .from("tcg_catalog_cards")
      .select("catalog_id,image_large_url,raw_json")
      .eq("franchise", "pokemon")
      .in("catalog_id", ["base1-4__unlimited", "base6-3__reverse_holo"]);
    if (error) throw new Error(error.message);
    const byId = new Map((data ?? []).map((row) => [row.catalog_id, row]));
    const base = byId.get("base1-4__unlimited");
    const reverse = byId.get("base6-3__reverse_holo");
    if (!base?.image_large_url) throw new Error("base1-4__unlimited image missing");
    if (!reverse?.image_large_url) throw new Error("base6-3__reverse_holo image missing");
  });

  ok &&= await check("pokemon set search matches plain DB terms", async () => {
    const { data, error } = await supabase
      .from("tcg_catalog_sets")
      .select("external_set_id,name,code")
      .eq("franchise", "pokemon")
      .or("name.ilike.%base%,code.ilike.%base%")
      .limit(5);
    if (error) throw new Error(error.message);
    if (!data?.some((set) => set.external_set_id === "base1")) {
      throw new Error("Base Set was not returned for plain 'base' search");
    }
  });

  ok &&= await check("magic browse excludes empty future placeholders", async () => {
    const { data, error } = await supabase
      .from("tcg_catalog_sets")
      .select("external_set_id,name,code,release_date,card_count")
      .eq("franchise", "magic")
      .or(`release_date.lte.${today},release_date.is.null,card_count.gt.0,card_count.is.null`)
      .order("release_date", { ascending: false, nullsFirst: false })
      .limit(10);
    if (error) throw new Error(error.message);
    const emptyFuture = data?.find(
      (set) => set.release_date > today && Number(set.card_count ?? 0) <= 0,
    );
    if (emptyFuture) throw new Error(`${emptyFuture.code ?? emptyFuture.external_set_id} is empty/future`);
    if (!data?.length) throw new Error("no visible magic sets returned");
  });

  ok &&= await check("yugioh set-name linkage fallback", async () => {
    const { data: setRows, error: setError } = await supabase
      .from("tcg_catalog_sets")
      .select("external_set_id,name,code")
      .eq("franchise", "yugioh")
      .eq("code", "MAMO")
      .limit(1);
    if (setError) throw new Error(setError.message);
    const setName = setRows?.[0]?.name;
    if (!setName) throw new Error("MAMO set row missing");

    const { count, error } = await supabase
      .from("tcg_catalog_cards")
      .select("id", { count: "exact", head: true })
      .eq("franchise", "yugioh")
      .eq("set_name", setName);
    if (error) throw new Error(error.message);
    if ((count ?? 0) < 1) throw new Error(`no cards linked by set_name=${setName}`);
  });

  if (!ok) process.exit(1);
  console.log("\nMaster catalog DB health checks passed.");
}

main();
