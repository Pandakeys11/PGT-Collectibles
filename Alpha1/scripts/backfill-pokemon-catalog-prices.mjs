/**
 * Resumable full-catalog Pokémon price backfill (set-by-set).
 *
 * Writes tcg_catalog_cards.prices_json + pgt_market_comps reference rows.
 * Checkpoint: .tmp/pokemon-price-backfill.json
 * Failures:   .tmp/pokemon-price-backfill-failures.jsonl
 * Log:        .tmp/pokemon-price-backfill.log (when run via npm script)
 *
 * Usage:
 *   node scripts/backfill-pokemon-catalog-prices.mjs
 *   node scripts/backfill-pokemon-catalog-prices.mjs --resume
 *   node scripts/backfill-pokemon-catalog-prices.mjs --reset
 *   node scripts/backfill-pokemon-catalog-prices.mjs --force
 *   node scripts/backfill-pokemon-catalog-prices.mjs --set=sv9
 *   node scripts/backfill-pokemon-catalog-prices.mjs --skip-comps
 *   node scripts/backfill-pokemon-catalog-prices.mjs --dry-run
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Recommended: POKEMON_TCG_API_KEY
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  priceSnapshotFromPokemonApiCard,
  priceSnapshotToPricesJson,
  snapshotHasTcgMarketPrices,
} from "./lib/catalog-price-snapshot.mjs";
import {
  referenceCompsFromPricesJson,
  persistReferenceCompsBatch,
} from "./lib/catalog-reference-comps.mjs";
import {
  tickRowsFromPricesJson,
  upsertPgtUsPriceTicksBatch,
} from "./lib/pgt-us-price-ticks.mjs";
import {
  fetchPokemonSetCardsFromApi,
  pokemonTcgHeaders,
  priceDelayMs,
} from "./lib/pokemon-set-price-hydrate.mjs";
import { loadEnvLocal } from "./load-env-local.mjs";

loadEnvLocal();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const TMP = path.join(ROOT, ".tmp");
const STATE_PATH = path.join(TMP, "pokemon-price-backfill.json");
const FAILURES_PATH = path.join(TMP, "pokemon-price-backfill-failures.jsonl");

const args = process.argv.slice(2);
const resume = args.includes("--resume") || !args.includes("--reset");
const reset = args.includes("--reset");
const force = args.includes("--force");
const dryRun = args.includes("--dry-run");
const skipComps = args.includes("--skip-comps");
const setFilter = args.find((a) => a.startsWith("--set="))?.split("=")[1]?.trim() || null;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const apiKey = process.env.POKEMON_TCG_API_KEY?.trim();
const delayMs = priceDelayMs();

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

if (!apiKey) {
  console.warn("WARNING: POKEMON_TCG_API_KEY not set — expect 429s and slow backfill.\n");
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
}

function ensureTmp() {
  if (!fs.existsSync(TMP)) fs.mkdirSync(TMP, { recursive: true });
}

function loadState() {
  ensureTmp();
  if (reset || !fs.existsSync(STATE_PATH)) {
    return {
      version: 1,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedSets: [],
      stats: {
        setsTotal: 0,
        setsDone: 0,
        cardsUpdated: 0,
        cardsPriced: 0,
        cardsNoApiPrice: 0,
        compsWritten: 0,
        failures: 0,
      },
    };
  }
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
  } catch {
    return {
      version: 1,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedSets: [],
      stats: {
        setsTotal: 0,
        setsDone: 0,
        cardsUpdated: 0,
        cardsPriced: 0,
        cardsNoApiPrice: 0,
        compsWritten: 0,
        failures: 0,
      },
    };
  }
}

function saveState(state) {
  ensureTmp();
  state.updatedAt = new Date().toISOString();
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function logFailure(entry) {
  ensureTmp();
  fs.appendFileSync(FAILURES_PATH, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`);
}

function pricesJsonFromApiCard(apiCard) {
  return priceSnapshotToPricesJson(priceSnapshotFromPokemonApiCard(apiCard));
}

function dbRowHasPrices(pricesJson) {
  const snap = priceSnapshotFromPokemonApiCard({
    tcgplayer: {
      url: pricesJson?.tcgPlayerUrl,
      updatedAt: pricesJson?.tcgPlayerUpdatedAt,
      prices: Object.fromEntries(
        (pricesJson?.tcgPlayerPrices ?? []).map((r) => [
          r.variant,
          { market: r.market, mid: r.mid, low: r.low },
        ]),
      ),
    },
  });
  return snapshotHasTcgMarketPrices(snap);
}

async function loadPokemonSets() {
  const sets = [];
  const pageSize = 500;
  for (let page = 0; page < 50; page += 1) {
    const { data, error } = await supabase
      .from("tcg_catalog_sets")
      .select("external_set_id,name,code,release_date,card_count")
      .eq("franchise", "pokemon")
      .order("release_date", { ascending: true, nullsFirst: false })
      .order("code", { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    for (const row of data) {
      const id = String(row.external_set_id ?? row.code ?? "").trim();
      if (!id) continue;
      sets.push({
        setId: id,
        name: String(row.name ?? id),
        code: row.code ?? id,
        releaseDate: row.release_date ?? null,
        cardCount: row.card_count ?? null,
      });
    }
    if (data.length < pageSize) break;
  }
  return sets;
}

async function loadDbCardsForSet(setId, setName) {
  const out = [];
  const pageSize = 500;
  for (let page = 0; page < 20; page += 1) {
    let q = supabase
      .from("tcg_catalog_cards")
      .select(
        "catalog_id,name,set_name,set_code,card_number,year,rarity,image_small_url,image_large_url,prices_json,raw_json",
      )
      .eq("franchise", "pokemon")
      .eq("set_code", setId)
      .range(page * pageSize, (page + 1) * pageSize - 1);
    let { data, error } = await q;
    if (error) throw error;
    if (!data?.length && setName) {
      ({ data, error } = await supabase
        .from("tcg_catalog_cards")
        .select(
          "catalog_id,name,set_name,set_code,card_number,year,rarity,image_small_url,image_large_url,prices_json,raw_json",
        )
        .eq("franchise", "pokemon")
        .eq("set_name", setName)
        .range(page * pageSize, (page + 1) * pageSize - 1));
      if (error) throw error;
    }
    if (!data?.length) break;
    out.push(...data);
    if (data.length < pageSize) break;
  }
  return out;
}

function normalizeKey(name, number) {
  const n = String(name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const raw = String(number ?? "").replace(/^#/, "").trim();
  const primary = (raw.split("/")[0] ?? raw).replace(/^0+/, "").trim() || raw;
  return `${n}|${primary}`;
}

async function upsertCardBatch(rows) {
  const chunkSize = 150;
  let ok = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from("tcg_catalog_cards").upsert(chunk, {
      onConflict: "franchise,catalog_id",
    });
    if (error) throw new Error(error.message);
    ok += chunk.length;
  }
  return ok;
}

async function verifySetPriced(setId) {
  const { count, error } = await supabase
    .from("tcg_catalog_cards")
    .select("catalog_id", { count: "exact", head: true })
    .eq("franchise", "pokemon")
    .eq("set_code", setId);
  if (error) return { total: 0, priced: 0 };

  const { data } = await supabase
    .from("tcg_catalog_cards")
    .select("prices_json")
    .eq("franchise", "pokemon")
    .eq("set_code", setId)
    .limit(5000);

  let priced = 0;
  for (const row of data ?? []) {
    if (dbRowHasPrices(row.prices_json)) priced += 1;
  }
  return { total: count ?? data?.length ?? 0, priced };
}

async function processSet(setMeta, state) {
  const { setId, name: setName } = setMeta;
  const phase = { setId, setName };

  if (!force && state.completedSets.includes(setId)) {
    return { skipped: true };
  }

  log(`SET ${setId} — ${setName}`);

  const dbCards = await loadDbCardsForSet(setId, setName);
  if (!dbCards.length) {
    log(`  no DB cards — marking complete`);
    if (!dryRun) {
      state.completedSets.push(setId);
      saveState(state);
    }
    return { cards: 0, priced: 0, updated: 0 };
  }

  log(`  DB cards: ${dbCards.length}`);

  let apiCards;
  try {
    apiCards = await fetchPokemonSetCardsFromApi(setId, {
      headers: pokemonTcgHeaders(),
      delayMs,
    });
  } catch (err) {
    logFailure({ ...phase, phase: "api_fetch", error: String(err?.message ?? err) });
    throw err;
  }

  log(`  API cards: ${apiCards.length}`);

  const apiById = new Map(apiCards.map((c) => [c.id, c]));
  const apiByKey = new Map(
    apiCards.map((c) => [normalizeKey(c.name, c.number), c]),
  );

  const upserts = [];
  const compRows = [];
  const tickRows = [];
  let priced = 0;
  let noPrice = 0;

  for (const row of dbCards) {
    const pokemonId = row.raw_json?.pokemonId ?? row.catalog_id;
    const apiCard =
      apiById.get(pokemonId) ??
      apiByKey.get(normalizeKey(row.name, row.card_number));

    if (!apiCard?.tcgplayer?.prices && !apiCard?.cardmarket?.prices) {
      noPrice += 1;
      if (!force && dbRowHasPrices(row.prices_json)) {
        priced += 1;
      }
      continue;
    }

    const pricesJson = pricesJsonFromApiCard(apiCard);
    if (!dbRowHasPrices(pricesJson)) {
      noPrice += 1;
      continue;
    }

    priced += 1;
    upserts.push({
      franchise: "pokemon",
      catalog_id: row.catalog_id,
      name: row.name,
      set_name: row.set_name,
      set_code: row.set_code ?? setId,
      card_number: row.card_number,
      year: row.year,
      rarity: row.rarity,
      image_small_url: row.image_small_url,
      image_large_url: row.image_large_url,
      prices_json: pricesJson,
      raw_json: { ...(row.raw_json ?? {}), pokemonId: apiCard.id ?? pokemonId },
      source_id: "pokemontcg.io",
      synced_at: new Date().toISOString(),
    });

    if (!skipComps) {
      compRows.push(...referenceCompsFromPricesJson(row.catalog_id, row.name, pricesJson));
    }
    tickRows.push(...tickRowsFromPricesJson(row.catalog_id, pricesJson));
  }

  log(`  priced: ${priced} / ${dbCards.length} (no API price: ${noPrice})`);

  if (dryRun) {
    log(`  DRY RUN — no writes`);
    return { cards: dbCards.length, priced, updated: 0 };
  }

  let updated = 0;
  if (upserts.length) {
    updated = await upsertCardBatch(upserts);
    log(`  upserted: ${updated} cards`);
  }

  let compsWritten = 0;
  if (compRows.length) {
    compsWritten = await persistReferenceCompsBatch(supabase, compRows);
    log(`  comps: ${compsWritten} reference rows`);
  }

  let ticksWritten = 0;
  if (tickRows.length) {
    ticksWritten = await upsertPgtUsPriceTicksBatch(supabase, tickRows);
    log(`  ticks: ${ticksWritten} price anchors`);
  }

  const verify = await verifySetPriced(setId);
  const pct =
    verify.total > 0 ? Math.round((100 * verify.priced) / verify.total) : 0;
  log(`  verify: ${verify.priced}/${verify.total} priced (${pct}%)`);

  if (priced === 0 && dbCards.length > 0) {
    const err = new Error(`zero priced cards for set ${setId}`);
    logFailure({ ...phase, phase: "verify", error: err.message, dbCards: dbCards.length });
    state.stats.failures += 1;
    saveState(state);
    throw err;
  }

  if (!state.completedSets.includes(setId)) {
    state.completedSets.push(setId);
  }
  state.stats.setsDone += 1;
  state.stats.cardsUpdated += updated;
  state.stats.cardsPriced += priced;
  state.stats.cardsNoApiPrice += noPrice;
  state.stats.compsWritten += compsWritten;
  saveState(state);

  return { cards: dbCards.length, priced, updated, compsWritten, verifyPct: pct };
}

async function main() {
  ensureTmp();
  if (reset) {
    log("RESET — clearing checkpoint");
    if (fs.existsSync(STATE_PATH)) fs.unlinkSync(STATE_PATH);
  }

  const state = loadState();
  const sets = await loadPokemonSets();
  state.stats.setsTotal = sets.length;
  saveState(state);

  log("=== Pokémon catalog price backfill (resumable) ===");
  log(`API key: ${apiKey ? "set" : "MISSING"}`);
  log(`Sets in DB: ${sets.length}`);
  log(`Completed: ${state.completedSets.length}`);
  log(`Resume: ${resume} | Force: ${force} | Dry run: ${dryRun}`);
  log(`State: ${STATE_PATH}`);
  log(`Failures: ${FAILURES_PATH}`);
  log(`Delay: ${delayMs}ms between API pages\n`);

  const queue = setFilter ? sets.filter((s) => s.setId === setFilter) : sets;
  if (setFilter && !queue.length) {
    console.error(`Set not found in catalog: ${setFilter}`);
    process.exit(1);
  }

  for (const setMeta of queue) {
    if (resume && !force && state.completedSets.includes(setMeta.setId)) {
      continue;
    }
    try {
      await processSet(setMeta, state);
    } catch (err) {
      state.stats.failures += 1;
      saveState(state);
      log(`FAIL ${setMeta.setId}: ${err?.message ?? err}`);
      log("  (checkpoint saved — re-run same command to resume)");
      await new Promise((r) => setTimeout(r, 3_000));
    }
  }

  const remaining = queue.filter((s) => !state.completedSets.includes(s.setId));
  log("\n=== Summary ===");
  log(`Sets completed: ${state.completedSets.length} / ${queue.length}`);
  log(`Cards updated: ${state.stats.cardsUpdated}`);
  log(`Cards priced: ${state.stats.cardsPriced}`);
  log(`Comps written: ${state.stats.compsWritten}`);
  log(`Failures logged: ${state.stats.failures}`);

  if (remaining.length) {
    log(`Remaining sets: ${remaining.length}`);
    log("Re-run: npm run catalog:backfill:prices");
    process.exitCode = 1;
  } else {
    log("All sets complete.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
