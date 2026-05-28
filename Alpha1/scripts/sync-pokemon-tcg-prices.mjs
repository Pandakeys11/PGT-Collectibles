/**
 * Backfill TCGPlayer + Cardmarket prices on tcg_catalog_cards.prices_json
 * via the free Pokémon TCG API v2 (https://dev.pokemontcg.io).
 *
 * Usage:
 *   node scripts/sync-pokemon-tcg-prices.mjs
 *   node scripts/sync-pokemon-tcg-prices.mjs --set=sv9
 *   node scripts/sync-pokemon-tcg-prices.mjs --all
 *   node scripts/sync-pokemon-tcg-prices.mjs --limit=50
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Recommended: POKEMON_TCG_API_KEY (free dev key — higher rate limits)
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./load-env-local.mjs";

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const apiKey = process.env.POKEMON_TCG_API_KEY?.trim();

const setFilter = process.argv.find((a) => a.startsWith("--set="))?.split("=")[1]?.trim() || null;
const limitArg = process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1];
const limit = limitArg ? Math.max(1, Number(limitArg) || 0) : null;
const allCards = process.argv.includes("--all");
const delayMs = Math.max(80, Number(process.env.POKEMON_TCG_PRICE_DELAY_MS ?? 220) || 220);

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

function priceSnapshotFromApiCard(card) {
  const tp = card.tcgplayer;
  const tcgPlayerPrices = tp?.prices
    ? Object.entries(tp.prices).map(([variant, block]) => ({
        variant,
        market: block?.market ?? null,
        mid: block?.mid ?? null,
        low: block?.low ?? null,
        high: block?.high ?? null,
        directLow: block?.directLow ?? null,
      }))
    : [];
  const cm = card.cardmarket?.prices;
  const cardMarket = cm
    ? {
        averageSellPrice: cm.averageSellPrice ?? null,
        trendPrice: cm.trendPrice ?? null,
        lowPrice: cm.lowPrice ?? null,
        avg7: cm.avg7 ?? null,
        avg30: cm.avg30 ?? null,
        reverseHoloTrend: cm.reverseHoloTrend ?? null,
      }
    : null;
  return {
    tcgPlayerUrl: tp?.url ?? null,
    tcgPlayerUpdatedAt: tp?.updatedAt ?? null,
    tcgPlayerPrices,
    cardMarketUrl: card.cardmarket?.url ?? null,
    cardMarketUpdatedAt: card.cardmarket?.updatedAt ?? null,
    cardMarket,
  };
}

function needsPriceRefresh(pricesJson) {
  if (allCards) return true;
  const p = pricesJson ?? {};
  const rows = p.tcgPlayerPrices;
  if (Array.isArray(rows) && rows.some((r) => r?.market != null || r?.mid != null)) {
    return false;
  }
  return true;
}

async function fetchCardFromApi(pokemonId) {
  const headers = { Accept: "application/json" };
  if (apiKey) headers["X-Api-Key"] = apiKey;

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(
        `https://api.pokemontcg.io/v2/cards/${encodeURIComponent(pokemonId)}`,
        { headers, signal: AbortSignal.timeout(20_000) },
      );
      if (res.status === 404) return null;
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 2_000 * (attempt + 1)));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      return body?.data ?? null;
    } catch (e) {
      if (attempt === 3) throw e;
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  return null;
}

async function loadCatalogRows() {
  const out = [];
  const pageSize = 500;
  let from = 0;
  for (;;) {
    let q = supabase
      .from("tcg_catalog_cards")
      .select(
        "catalog_id,name,set_name,set_code,card_number,year,rarity,image_small_url,image_large_url,prices_json,raw_json",
      )
      .eq("franchise", "pokemon")
      .order("catalog_id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (setFilter) q = q.eq("set_code", setFilter);
    const { data, error } = await q;
    if (error) throw error;
    if (!data?.length) break;
    out.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

async function main() {
  console.log("=== Pokémon catalog TCGPlayer price sync ===");
  console.log("API key:", apiKey ? "set (recommended)" : "none — slower rate limits");
  if (setFilter) console.log("Set filter:", setFilter);
  if (limit) console.log("Limit:", limit);
  console.log("Mode:", allCards ? "refresh all" : "missing prices only");
  console.log("Delay between requests:", delayMs, "ms\n");

  const rows = await loadCatalogRows();
  console.log(`Loaded ${rows.length} catalog rows`);

  let targets = rows.filter((r) => needsPriceRefresh(r.prices_json));
  if (limit) targets = targets.slice(0, limit);
  console.log(`Will refresh: ${targets.length} cards\n`);

  if (targets.length === 0) {
    console.log("Nothing to do — all rows already have tcgPlayerPrices.");
    return;
  }

  let ok = 0;
  let skip = 0;
  let fail = 0;

  for (let i = 0; i < targets.length; i++) {
    const row = targets[i];
    const pokemonId = row.raw_json?.pokemonId ?? row.catalog_id;
    try {
      const apiCard = await fetchCardFromApi(pokemonId);
      if (!apiCard) {
        skip += 1;
        process.stdout.write("s");
      } else if (!apiCard.tcgplayer?.prices && !apiCard.cardmarket?.prices) {
        skip += 1;
        process.stdout.write("-");
      } else {
        const pricesJson = priceSnapshotFromApiCard(apiCard);
        const { error } = await supabase.from("tcg_catalog_cards").upsert(
          {
            franchise: "pokemon",
            catalog_id: row.catalog_id,
            name: row.name,
            set_name: row.set_name,
            set_code: row.set_code,
            card_number: row.card_number,
            year: row.year,
            rarity: row.rarity,
            image_small_url: row.image_small_url,
            image_large_url: row.image_large_url,
            prices_json: pricesJson,
            raw_json: { ...(row.raw_json ?? {}), pokemonId: apiCard.id ?? pokemonId },
            source_id: "pokemontcg.io",
            synced_at: new Date().toISOString(),
          },
          { onConflict: "franchise,catalog_id" },
        );
        if (error) {
          fail += 1;
          process.stdout.write("!");
        } else {
          ok += 1;
          process.stdout.write(".");
        }
      }
    } catch {
      fail += 1;
      process.stdout.write("x");
    }

    if ((i + 1) % 80 === 0) {
      process.stdout.write(` ${i + 1}/${targets.length}\n`);
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }

  console.log(`\n\nDone. updated=${ok} no_api_prices=${skip} failed=${fail}`);
  const estMin = Math.round((targets.length * delayMs) / 60_000);
  if (targets.length > 500) {
    console.log(
      `\nTip: full catalog may take ~${estMin}+ minutes. Run overnight or per set:`,
    );
    console.log("  node scripts/sync-pokemon-tcg-prices.mjs --set=sv9");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
