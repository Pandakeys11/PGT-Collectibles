/**
 * Resumable JustTCG price hydrate for non-Pokémon catalog franchises.
 *
 * Franchises: magic, yugioh, lorcana, onepiece
 * Pokémon continues to use pokemontcg.io (catalog:backfill:prices).
 *
 * Checkpoint: .tmp/justtcg-price-sync.json
 * Failures:   .tmp/justtcg-price-sync-failures.jsonl
 *
 * Usage:
 *   node scripts/sync-justtcg-catalog-prices.mjs --resume
 *   node scripts/sync-justtcg-catalog-prices.mjs --franchise=magic
 *   node scripts/sync-justtcg-catalog-prices.mjs --set=neo --franchise=magic
 *   node scripts/sync-justtcg-catalog-prices.mjs --reset
 *   node scripts/sync-justtcg-catalog-prices.mjs --dry-run
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JUSTTCG_API_KEY
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  referenceCompsFromPricesJson,
  persistReferenceCompsBatch,
} from "./lib/catalog-reference-comps.mjs";
import { isJustTcgConfigured, justTcgBatchLookupCards } from "./lib/justtcg-client.mjs";
import {
  JUSTTCG_FRANCHISES,
  batchLookupItemForRow,
  dbRowHasJustTcgPrices,
  justTcgGameForFranchise,
  justTcgCardHasPrices,
  matchJustTcgCardToRow,
  mergeJustTcgIntoPricesJson,
} from "./lib/justtcg-price-snapshot.mjs";
import { loadEnvLocal } from "./load-env-local.mjs";

loadEnvLocal();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const TMP = path.join(ROOT, ".tmp");
const STATE_PATH = path.join(TMP, "justtcg-price-sync.json");
const FAILURES_PATH = path.join(TMP, "justtcg-price-sync-failures.jsonl");

const args = process.argv.slice(2);
const resume = args.includes("--resume") || !args.includes("--reset");
const reset = args.includes("--reset");
const force = args.includes("--force");
const dryRun = args.includes("--dry-run");
const skipComps = args.includes("--skip-comps");
const franchiseFilter = args.find((a) => a.startsWith("--franchise="))?.split("=")[1]?.trim() || null;
const setFilter = args.find((a) => a.startsWith("--set="))?.split("=")[1]?.trim() || null;

const batchSize = Math.min(
  20,
  Math.max(1, Number(process.env.JUSTTCG_BATCH_SIZE ?? 20)),
);
const delayMs = Math.max(200, Number(process.env.JUSTTCG_SYNC_DELAY_MS ?? 450));
const setPauseMs = Math.max(0, Number(process.env.JUSTTCG_SET_PAUSE_MS ?? 1500));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!isJustTcgConfigured()) {
  console.error("Missing JUSTTCG_API_KEY (or Just_Pokemon_TCG_API_KEY)");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function ensureTmp() {
  if (!fs.existsSync(TMP)) fs.mkdirSync(TMP, { recursive: true });
}

function loadState() {
  ensureTmp();
  if (reset || !resume || !fs.existsSync(STATE_PATH)) {
    return {
      version: 1,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedSets: [],
      cursor: null,
      stats: {
        franchises: 0,
        setsDone: 0,
        cardsProcessed: 0,
        cardsPriced: 0,
        cardsNoPrice: 0,
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
      cursor: null,
      stats: {
        franchises: 0,
        setsDone: 0,
        cardsProcessed: 0,
        cardsPriced: 0,
        cardsNoPrice: 0,
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
  fs.appendFileSync(
    FAILURES_PATH,
    `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`,
  );
}

function setKey(franchise, setId) {
  return `${franchise}|${setId}`;
}

async function loadSetsForFranchise(franchise) {
  const sets = [];
  const pageSize = 500;
  for (let page = 0; page < 50; page += 1) {
    const { data, error } = await supabase
      .from("tcg_catalog_sets")
      .select("external_set_id,name,code,card_count")
      .eq("franchise", franchise)
      .order("release_date", { ascending: true, nullsFirst: false })
      .order("code", { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    for (const row of data) {
      const setId = String(row.external_set_id ?? row.code ?? "").trim();
      if (!setId) continue;
      sets.push({
        franchise,
        setId,
        setName: String(row.name ?? setId),
        code: row.code ?? setId,
        cardCount: row.card_count ?? null,
      });
    }
    if (data.length < pageSize) break;
  }
  return sets;
}

async function loadDbCardsForSet(franchise, setId, setName) {
  const out = [];
  const pageSize = 500;
  for (let page = 0; page < 20; page += 1) {
    let { data, error } = await supabase
      .from("tcg_catalog_cards")
      .select(
        "catalog_id,name,set_name,set_code,card_number,year,rarity,image_small_url,image_large_url,prices_json,raw_json",
      )
      .eq("franchise", franchise)
      .eq("set_code", setId)
      .order("card_number", { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) throw error;
    if (!data?.length && setName) {
      ({ data, error } = await supabase
        .from("tcg_catalog_cards")
        .select(
          "catalog_id,name,set_name,set_code,card_number,year,rarity,image_small_url,image_large_url,prices_json,raw_json",
        )
        .eq("franchise", franchise)
        .eq("set_name", setName)
        .order("card_number", { ascending: true })
        .range(page * pageSize, (page + 1) * pageSize - 1));
      if (error) throw error;
    }
    if (!data?.length) break;
    out.push(...data);
    if (data.length < pageSize) break;
  }
  return out;
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

async function hydrateBatch(franchise, game, rows, state) {
  const lookupByKey = new Map();
  const rowsByKey = new Map();

  for (const row of rows) {
    const { key, item } = batchLookupItemForRow(row, game);
    lookupByKey.set(key, item);
    const bucket = rowsByKey.get(key) ?? [];
    bucket.push(row);
    rowsByKey.set(key, bucket);
  }

  const items = [...lookupByKey.values()];
  const result = await justTcgBatchLookupCards(items);
  if (result.error) {
    for (const row of rows) {
      state.stats.failures += 1;
      logFailure({
        franchise,
        catalogId: row.catalog_id,
        phase: "batch_lookup",
        error: result.error,
      });
    }
    return { priced: 0, updated: 0, comps: 0, noPrice: rows.length };
  }

  const upserts = [];
  const compRows = [];
  let priced = 0;
  let noPrice = 0;

  for (const [key, keyedRows] of rowsByKey.entries()) {
    const item = lookupByKey.get(key);
    const candidates = result.cards.filter((card) => {
      if (item.tcgplayerId && String(card.tcgplayerId ?? "") === String(item.tcgplayerId)) {
        return true;
      }
      if (item.query && item.number) {
        const name = String(card.name ?? "").toLowerCase();
        const q = item.query.toLowerCase();
        const num = String(card.number ?? "").replace(/^#/, "").trim();
        return (name.includes(q) || q.includes(name)) && num === String(item.number).trim();
      }
      return false;
    });

    const match = matchJustTcgCardToRow(keyedRows[0], candidates.length ? candidates : result.cards);

    for (const row of keyedRows) {
      if (!force && dbRowHasJustTcgPrices(row.prices_json)) {
        priced += 1;
        continue;
      }

      if (!match || !justTcgCardHasPrices(match)) {
        noPrice += 1;
        state.stats.cardsNoPrice += 1;
        continue;
      }

      const pricesJson = mergeJustTcgIntoPricesJson(match, row.prices_json);
      priced += 1;

      if (dryRun) {
        log(`  [dry-run] ${row.catalog_id} · ${row.name} → priced`);
        continue;
      }

      upserts.push({
        franchise,
        catalog_id: row.catalog_id,
        name: row.name,
        printed_name: row.name,
        set_name: row.set_name,
        set_code: row.set_code,
        card_number: row.card_number,
        year: row.year,
        rarity: row.rarity,
        image_small_url: row.image_small_url,
        image_large_url: row.image_large_url,
        prices_json: pricesJson,
        raw_json: row.raw_json ?? {},
        source_id: "justtcg.com",
        synced_at: new Date().toISOString(),
      });

      if (!skipComps) {
        compRows.push(
          ...referenceCompsFromPricesJson(row.catalog_id, row.name, pricesJson, franchise),
        );
      }
    }
  }

  if (dryRun) {
    return { priced, updated: 0, comps: 0, noPrice };
  }

  const updated = upserts.length ? await upsertCardBatch(upserts) : 0;
  const comps = skipComps ? 0 : await persistReferenceCompsBatch(supabase, compRows);
  state.stats.cardsPriced += priced;
  state.stats.compsWritten += comps;
  return { priced, updated, comps, noPrice };
}

async function processSet(setMeta, state) {
  const { franchise, setId, setName } = setMeta;
  const sk = setKey(franchise, setId);
  const game = justTcgGameForFranchise(franchise);

  if (!game) {
    log(`SKIP ${franchise}/${setId} — no JustTCG game mapping`);
    return;
  }

  if (!force && state.completedSets.includes(sk)) {
    log(`SKIP ${sk} — completed`);
    return;
  }

  const dbCards = await loadDbCardsForSet(franchise, setId, setName);
  if (!dbCards.length) {
    log(`${sk} — no cards, marking complete`);
    if (!dryRun) {
      state.completedSets.push(sk);
      saveState(state);
    }
    return;
  }

  log(`${sk} — ${setName} (${dbCards.length} cards)`);

  let startBatch = 0;
  if (state.cursor?.setKey === sk) {
    startBatch = Math.max(0, state.cursor.batchIndex ?? 0);
    log(`  resume batch ${startBatch + 1}`);
  }

  for (let i = startBatch; i < dbCards.length; i += batchSize) {
    const batch = dbCards.slice(i, i + batchSize);
    state.stats.cardsProcessed += batch.length;

    try {
      const result = await hydrateBatch(franchise, game, batch, state);
      log(
        `  batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(dbCards.length / batchSize)} — priced=${result.priced} updated=${result.updated} noPrice=${result.noPrice} comps=${result.comps}`,
      );
    } catch (err) {
      state.stats.failures += 1;
      const message = err instanceof Error ? err.message : String(err);
      logFailure({ setKey: sk, phase: "batch", error: message });
      log(`  batch FAIL: ${message}`);
    }

    if (!dryRun) {
      state.cursor = { setKey: sk, batchIndex: i + batchSize };
      saveState(state);
    }
    await sleep(delayMs);
  }

  if (!dryRun) {
    state.completedSets.push(sk);
    state.cursor = null;
    state.stats.setsDone += 1;
    saveState(state);
    log(`${sk} — complete`);
    if (setPauseMs > 0) await sleep(setPauseMs);
  }
}

async function main() {
  const state = loadState();
  const franchises = franchiseFilter
    ? JUSTTCG_FRANCHISES.filter((f) => f === franchiseFilter)
    : JUSTTCG_FRANCHISES;

  if (!franchises.length) {
    console.error(`Unknown franchise: ${franchiseFilter}`);
    process.exit(1);
  }

  state.stats.franchises = franchises.length;
  saveState(state);

  log(
    `JustTCG price sync — franchises=${franchises.join(",")} batch=${batchSize} delay=${delayMs}ms dryRun=${dryRun}`,
  );

  for (const franchise of franchises) {
    const sets = await loadSetsForFranchise(franchise);
    const queue = setFilter
      ? sets.filter((s) => s.setId === setFilter || s.code === setFilter)
      : sets;
    if (!queue.length) {
      log(`No sets for ${franchise}${setFilter ? ` matching ${setFilter}` : ""}`);
      continue;
    }
    log(`${franchise}: ${queue.length} set(s)`);
    for (const setMeta of queue) {
      await processSet(setMeta, state);
    }
  }

  log(
    `Done. sets=${state.stats.setsDone} cards=${state.stats.cardsProcessed} priced=${state.stats.cardsPriced} empty=${state.stats.cardsNoPrice} comps=${state.stats.compsWritten} failures=${state.stats.failures}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
