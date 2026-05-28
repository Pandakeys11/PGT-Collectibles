/**
 * Resumable full-catalog Pokémon PSA 10 comp backfill (set-by-set, card-by-card).
 *
 * Tier 1: PriceCharting graded / PSA 10 guide → pgt_market_comps (reference, grade_bucket=psa10)
 * Tier 3: eBay sold + active PSA 10 lanes → pgt_market_comps (sold/active, grade_bucket=psa10)
 *
 * Checkpoint: .tmp/pokemon-psa10-backfill.json
 * Failures:   .tmp/pokemon-psa10-backfill-failures.jsonl
 *
 * Usage:
 *   npx --yes tsx scripts/backfill-pokemon-psa10-comps.ts
 *   npx --yes tsx scripts/backfill-pokemon-psa10-comps.ts --resume
 *   npx --yes tsx scripts/backfill-pokemon-psa10-comps.ts --reset
 *   npx --yes tsx scripts/backfill-pokemon-psa10-comps.ts --set=sv9
 *   npx --yes tsx scripts/backfill-pokemon-psa10-comps.ts --skip-ebay
 *   npx --yes tsx scripts/backfill-pokemon-psa10-comps.ts --skip-pricecharting
 *   npx --yes tsx scripts/backfill-pokemon-psa10-comps.ts --dry-run
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Tier 1:    PRICECHARTING_API_TOKEN
 * Tier 3:    eBay browse credentials and/or Bright Data sold scrape (see verify:ebay-sold)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import type { CatalogCardSummary, CatalogFranchiseId } from "@/lib/catalog/catalog-types";
import { parseCatalogPriceSnapshot } from "@/lib/market/catalog-reference-evidence";
import { processPsa10CatalogCard } from "@/lib/catalog/psa10-catalog-harvest";
import { brightDataEbayQuotaLabel } from "@/lib/market/brightdata/ebay-sold-unlocker";
import { getPriceChartingApiToken, isEbayBrowseConfigured } from "@/lib/market/env-market";
import { getMarketCapabilities } from "@/lib/market/market-capabilities";
import { loadEnvLocal } from "./load-env-local.mjs";

loadEnvLocal();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const TMP = path.join(ROOT, ".tmp");
const STATE_PATH = path.join(TMP, "pokemon-psa10-backfill.json");
const FAILURES_PATH = path.join(TMP, "pokemon-psa10-backfill-failures.jsonl");

const args = process.argv.slice(2);
const resume = args.includes("--resume") || !args.includes("--reset");
const reset = args.includes("--reset");
const force = args.includes("--force");
const dryRun = args.includes("--dry-run");
const skipEbay = args.includes("--skip-ebay") || process.env.PSA10_BACKFILL_SKIP_EBAY === "1";
const skipPriceCharting =
  args.includes("--skip-pricecharting") || process.env.PSA10_BACKFILL_SKIP_PRICECHARTING === "1";
const setFilter = args.find((a) => a.startsWith("--set="))?.split("=")[1]?.trim() || null;

const delayMs = Math.max(
  200,
  Number(process.env.PSA10_BACKFILL_DELAY_MS ?? process.env.MARKET_INGEST_DELAY_MS ?? 450),
);
const setPauseMs = Math.max(0, Number(process.env.PSA10_BACKFILL_SET_PAUSE_MS ?? 2000));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

function printTierReadiness(): { tier1Ready: boolean; tier3Ready: boolean } {
  const pcToken = getPriceChartingApiToken();
  const tier1Ready = !skipPriceCharting && Boolean(pcToken);
  const caps = getMarketCapabilities();
  const tier3Ready = !skipEbay && (caps.ebaySoldReady || caps.ebayBrowseReady);

  console.log(
    `Tier 1 PriceCharting: ${tier1Ready ? "ready" : skipPriceCharting ? "skipped (--skip-pricecharting)" : "OFF — set PRICECHARTING_API_TOKEN in .env.local"}`,
  );
  if (!skipEbay) {
    console.log(`Tier 3 eBay sold pipeline: ${caps.ebaySoldReady ? "ready" : "OFF"}`);
    if (!caps.ebaySoldReady && caps.ebaySoldGaps.length) {
      console.log(`  sold gaps: ${caps.ebaySoldGaps.join("; ")}`);
    }
    console.log(`  Bright Data eBay budget: ${brightDataEbayQuotaLabel()}`);
    console.log(
      `  eBay Browse (active listings): ${isEbayBrowseConfigured() ? "ready" : "OFF — set EBAY_CLIENT_ID + EBAY_CLIENT_SECRET"}`,
    );
  } else {
    console.log("Tier 3 eBay: skipped (--skip-ebay)");
  }
  console.log("");

  if (!tier1Ready && !tier3Ready && !dryRun) {
    console.error("No comp sources available — every card will log “no comps”. Fix env then re-run:");
    console.error("  npm run verify:ebay-sold");
    process.exit(1);
  }

  return { tier1Ready, tier3Ready };
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

type BackfillState = {
  version: 1;
  startedAt: string;
  updatedAt: string;
  completedSets: string[];
  cursor: { setId: string; cardIndex: number } | null;
  stats: {
    setsTotal: number;
    setsDone: number;
    cardsProcessed: number;
    cardsWithComps: number;
    cardsEmpty: number;
    priceChartingRows: number;
    ebayRows: number;
    failures: number;
  };
};

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function ensureTmp() {
  if (!fs.existsSync(TMP)) fs.mkdirSync(TMP, { recursive: true });
}

function loadState(): BackfillState {
  ensureTmp();
  if (reset || !resume || !fs.existsSync(STATE_PATH)) {
    return {
      version: 1,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedSets: [],
      cursor: null,
      stats: {
        setsTotal: 0,
        setsDone: 0,
        cardsProcessed: 0,
        cardsWithComps: 0,
        cardsEmpty: 0,
        priceChartingRows: 0,
        ebayRows: 0,
        failures: 0,
      },
    };
  }
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, "utf8")) as BackfillState;
  } catch {
    return {
      version: 1,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedSets: [],
      cursor: null,
      stats: {
        setsTotal: 0,
        setsDone: 0,
        cardsProcessed: 0,
        cardsWithComps: 0,
        cardsEmpty: 0,
        priceChartingRows: 0,
        ebayRows: 0,
        failures: 0,
      },
    };
  }
}

function saveState(state: BackfillState) {
  ensureTmp();
  state.updatedAt = new Date().toISOString();
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function logFailure(entry: Record<string, unknown>) {
  ensureTmp();
  fs.appendFileSync(
    FAILURES_PATH,
    `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`,
  );
}

type DbCardRow = {
  catalog_id: string;
  name: string;
  set_name: string | null;
  set_code: string | null;
  card_number: string | null;
  year: string | null;
  rarity: string | null;
  image_small_url: string | null;
  image_large_url: string | null;
  prices_json: Record<string, unknown> | null;
  raw_json: Record<string, unknown> | null;
};

function dbRowToSummary(row: DbCardRow, setMeta: { setId: string; setName: string }): CatalogCardSummary {
  const franchise: CatalogFranchiseId = "pokemon";
  return {
    id: row.catalog_id,
    name: row.name,
    number: row.card_number,
    rarity: row.rarity,
    supertype: null,
    sourceCatalogId:
      typeof row.raw_json?.pokemonId === "string" ? row.raw_json.pokemonId : row.catalog_id,
    images: {
      small: row.image_small_url ?? undefined,
      large: row.image_large_url ?? row.image_small_url ?? undefined,
    },
    set: {
      id: setMeta.setId,
      name: setMeta.setName,
      code: row.set_code,
      releaseDate: row.year ? `${row.year}-01-01` : undefined,
    },
    franchise,
    prices: parseCatalogPriceSnapshot(row.prices_json),
  };
}

async function loadPokemonSets() {
  const sets: Array<{
    setId: string;
    name: string;
    code: string;
    releaseDate: string | null;
    cardCount: number | null;
  }> = [];
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
        code: String(row.code ?? id),
        releaseDate: row.release_date ?? null,
        cardCount: row.card_count ?? null,
      });
    }
    if (data.length < pageSize) break;
  }
  return sets;
}

async function loadDbCardsForSet(setId: string, setName: string): Promise<DbCardRow[]> {
  const out: DbCardRow[] = [];
  const pageSize = 500;
  for (let page = 0; page < 20; page += 1) {
    let { data, error } = await supabase
      .from("tcg_catalog_cards")
      .select(
        "catalog_id,name,set_name,set_code,card_number,year,rarity,image_small_url,image_large_url,prices_json,raw_json",
      )
      .eq("franchise", "pokemon")
      .eq("set_code", setId)
      .order("card_number", { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) throw error;
    if (!data?.length) {
      ({ data, error } = await supabase
        .from("tcg_catalog_cards")
        .select(
          "catalog_id,name,set_name,set_code,card_number,year,rarity,image_small_url,image_large_url,prices_json,raw_json",
        )
        .eq("franchise", "pokemon")
        .eq("set_name", setName)
        .order("card_number", { ascending: true })
        .range(page * pageSize, (page + 1) * pageSize - 1));
      if (error) throw error;
    }
    if (!data?.length) break;
    out.push(...(data as DbCardRow[]));
    if (data.length < pageSize) break;
  }
  return out;
}

async function processSet(
  setMeta: { setId: string; name: string },
  state: BackfillState,
): Promise<void> {
  const { setId, name: setName } = setMeta;

  if (!force && state.completedSets.includes(setId)) {
    log(`SET ${setId} — skip (completed)`);
    return;
  }

  const dbCards = await loadDbCardsForSet(setId, setName);
  if (!dbCards.length) {
    log(`SET ${setId} — no cards, marking complete`);
    if (!dryRun) {
      state.completedSets.push(setId);
      state.cursor = null;
      saveState(state);
    }
    return;
  }

  let startIndex = 0;
  if (state.cursor?.setId === setId) {
    startIndex = Math.max(0, state.cursor.cardIndex);
    log(`SET ${setId} — resume at card ${startIndex + 1}/${dbCards.length}`);
  } else {
    log(`SET ${setId} — ${setName} (${dbCards.length} cards)`);
  }

  for (let i = startIndex; i < dbCards.length; i += 1) {
    const row = dbCards[i]!;
    const summary = dbRowToSummary(row, { setId, setName });
    const label = `${summary.id} · ${summary.name}`;

    if (dryRun) {
      log(`  [dry-run] ${i + 1}/${dbCards.length} ${label}`);
      continue;
    }

    try {
      const result = await processPsa10CatalogCard(summary, {
        skipEbay,
        skipPriceCharting,
      });
      state.stats.cardsProcessed += 1;
      if (result.persisted) {
        state.stats.cardsWithComps += 1;
        state.stats.priceChartingRows += result.priceChartingRows;
        state.stats.ebayRows += result.ebayRows;
        log(
          `  ${i + 1}/${dbCards.length} ${label} — comps=${result.totalRows} (PC=${result.priceChartingRows} eBay=${result.ebayRows}) guide=$${result.psa10GuideUsd ?? "—"}`,
        );
      } else {
        state.stats.cardsEmpty += 1;
        log(`  ${i + 1}/${dbCards.length} ${label} — no comps`);
      }
    } catch (err) {
      state.stats.failures += 1;
      const message = err instanceof Error ? err.message : String(err);
      logFailure({ setId, catalogId: summary.id, name: summary.name, error: message });
      log(`  ${i + 1}/${dbCards.length} ${label} — FAIL: ${message}`);
    }

    state.cursor = { setId, cardIndex: i + 1 };
    saveState(state);
    await sleep(delayMs);
  }

  if (!dryRun) {
    state.completedSets.push(setId);
    state.cursor = null;
    state.stats.setsDone += 1;
    saveState(state);
    log(`SET ${setId} — complete`);
    if (setPauseMs > 0) await sleep(setPauseMs);
  }
}

async function main() {
  const { tier1Ready, tier3Ready } = printTierReadiness();
  const state = loadState();
  const sets = await loadPokemonSets();
  state.stats.setsTotal = sets.length;
  saveState(state);

  const queue = setFilter ? sets.filter((s) => s.setId === setFilter || s.code === setFilter) : sets;
  if (!queue.length) {
    console.error(setFilter ? `No set matched --set=${setFilter}` : "No Pokémon sets in DB");
    process.exit(1);
  }

  log(
    `PSA 10 backfill — ${queue.length} set(s) | Tier1=${skipPriceCharting ? "off" : tier1Ready ? "on" : "off"} Tier3=${skipEbay ? "off" : tier3Ready ? "on" : "off"} | delay=${delayMs}ms`,
  );

  for (const setMeta of queue) {
    await processSet(setMeta, state);
  }

  log(
    `Done. sets=${state.stats.setsDone}/${state.stats.setsTotal} cards=${state.stats.cardsProcessed} withComps=${state.stats.cardsWithComps} empty=${state.stats.cardsEmpty} failures=${state.stats.failures}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
