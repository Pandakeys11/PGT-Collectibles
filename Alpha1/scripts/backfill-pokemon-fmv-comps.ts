/**
 * Resumable full-catalog Pokémon FMV + sold-comp backfill (set-by-set).
 *
 * Per card: TCGPlayer/Cardmarket refresh, eBay + PriceCharting sold harvest,
 * optional AI research, persist to `pgt_market_comps` + `prices_json`.
 * Default lookback: last 60 days of dated sold comps (undated sold kept).
 *
 * Checkpoint: .tmp/pokemon-fmv-backfill.json
 * Failures:   .tmp/pokemon-fmv-backfill-failures.jsonl
 *
 * Usage:
 *   npx --yes tsx scripts/backfill-pokemon-fmv-comps.ts
 *   npx --yes tsx scripts/backfill-pokemon-fmv-comps.ts --resume
 *   npx --yes tsx scripts/backfill-pokemon-fmv-comps.ts --reset
 *   npx --yes tsx scripts/backfill-pokemon-fmv-comps.ts --days=60
 *   npx --yes tsx scripts/backfill-pokemon-fmv-comps.ts --set=me4
 *   npx --yes tsx scripts/backfill-pokemon-fmv-comps.ts --skip-fresh
 *   npx --yes tsx scripts/backfill-pokemon-fmv-comps.ts --prune-old
 *   npx --yes tsx scripts/backfill-pokemon-fmv-comps.ts --refresh-set-insights
 *   npx --yes tsx scripts/backfill-pokemon-fmv-comps.ts --dry-run
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Recommended: POKEMON_TCG_API_KEY, eBay sold + PriceCharting (see verify:ebay-sold)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { rebuildSetInsightForSet } from "@/lib/catalog/set-insight-nightly";
import { brightDataEbayQuotaLabel } from "@/lib/market/brightdata/ebay-sold-unlocker";
import { isEbayBrowseConfigured } from "@/lib/market/env-market";
import { getMarketCapabilities } from "@/lib/market/market-capabilities";
import { getPriceChartingReadiness } from "@/lib/market/pricecharting/readiness";
import { ingestCatalogMarketIntel } from "@/lib/pgt-registry/catalog-intel-ingest";
import { loadEnvLocal } from "./load-env-local.mjs";

loadEnvLocal();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const TMP = path.join(ROOT, ".tmp");
const STATE_PATH = path.join(TMP, "pokemon-fmv-backfill.json");
const FAILURES_PATH = path.join(TMP, "pokemon-fmv-backfill-failures.jsonl");

const args = process.argv.slice(2);
const resume = args.includes("--resume") || !args.includes("--reset");
const reset = args.includes("--reset");
const force = args.includes("--force");
const dryRun = args.includes("--dry-run");
const skipFresh = args.includes("--skip-fresh");
const pruneOld = args.includes("--prune-old");
const refreshSetInsights = args.includes("--refresh-set-insights");
const setFilter = args.find((a) => a.startsWith("--set="))?.split("=")[1]?.trim() || null;
const daysArg = args.find((a) => a.startsWith("--days="))?.split("=")[1]?.trim();
const lookbackDays = Math.min(
  365,
  Math.max(7, Number(daysArg ?? process.env.FMV_BACKFILL_LOOKBACK_DAYS ?? 60) || 60),
);
const minFreshSold = Math.max(
  1,
  Number(process.env.FMV_BACKFILL_MIN_SOLD_COMPS ?? 3) || 3,
);

process.env.MARKET_MAX_EVIDENCE_AGE_DAYS = String(lookbackDays);
process.env.MARKET_SOLD_LOOKBACK_DAYS = String(lookbackDays);

const delayMs = Math.max(
  300,
  Number(process.env.FMV_BACKFILL_DELAY_MS ?? process.env.MARKET_INGEST_DELAY_MS ?? 600),
);
const setPauseMs = Math.max(0, Number(process.env.FMV_BACKFILL_SET_PAUSE_MS ?? 1500));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

type BackfillState = {
  version: 1;
  lookbackDays: number;
  startedAt: string;
  updatedAt: string;
  completedSets: string[];
  cursor: { setId: string; cardIndex: number } | null;
  stats: {
    setsTotal: number;
    setsDone: number;
    cardsProcessed: number;
    cardsSkippedFresh: number;
    cardsWithComps: number;
    cardsEmpty: number;
    soldCompsWritten: number;
    pricesRefreshed: number;
    failures: number;
    setInsightsRefreshed: number;
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
      lookbackDays,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedSets: [],
      cursor: null,
      stats: {
        setsTotal: 0,
        setsDone: 0,
        cardsProcessed: 0,
        cardsSkippedFresh: 0,
        cardsWithComps: 0,
        cardsEmpty: 0,
        soldCompsWritten: 0,
        pricesRefreshed: 0,
        failures: 0,
        setInsightsRefreshed: 0,
      },
    };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(STATE_PATH, "utf8")) as BackfillState;
    parsed.lookbackDays = lookbackDays;
    return parsed;
  } catch {
    return {
      version: 1,
      lookbackDays,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedSets: [],
      cursor: null,
      stats: {
        setsTotal: 0,
        setsDone: 0,
        cardsProcessed: 0,
        cardsSkippedFresh: 0,
        cardsWithComps: 0,
        cardsEmpty: 0,
        soldCompsWritten: 0,
        pricesRefreshed: 0,
        failures: 0,
        setInsightsRefreshed: 0,
      },
    };
  }
}

function saveState(state: BackfillState) {
  ensureTmp();
  state.updatedAt = new Date().toISOString();
  state.lookbackDays = lookbackDays;
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function logFailure(entry: Record<string, unknown>) {
  ensureTmp();
  fs.appendFileSync(
    FAILURES_PATH,
    `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`,
  );
}

function printReadiness(): { pcReady: boolean; ebayReady: boolean } {
  const caps = getMarketCapabilities();
  const pc = getPriceChartingReadiness();
  console.log(`Lookback: ${lookbackDays} days (dated sold comps)`);
  console.log(`PriceCharting API: ${pc.apiReady ? "ready" : "OFF — set PRICECHARTING_API_TOKEN"}`);
  console.log(
    `PriceCharting sold scrape: ${pc.soldScrapeReady ? "ready (Bright Data)" : pc.soldScrapeEnabled ? "enabled but unlocker blocked" : "disabled"}`,
  );
  if (pc.gaps.length) console.log(`  PC gaps: ${pc.gaps.join("; ")}`);
  console.log(`eBay sold pipeline: ${caps.ebaySoldReady ? "ready" : "OFF"}`);
  if (!caps.ebaySoldReady && caps.ebaySoldGaps.length) {
    console.log(`  sold gaps: ${caps.ebaySoldGaps.join("; ")}`);
  }
  console.log(`  Bright Data eBay budget: ${brightDataEbayQuotaLabel()}`);
  console.log(
    `eBay Browse (active): ${isEbayBrowseConfigured() ? "ready" : "OFF — EBAY_CLIENT_ID + EBAY_CLIENT_SECRET"}`,
  );
  console.log(
    `Pokémon TCG API: ${process.env.POKEMON_TCG_API_KEY?.trim() ? "key set" : "no key — slower / 429 risk"}`,
  );
  console.log("");
  return { pcReady: pc.productionReady, ebayReady: caps.ebaySoldReady };
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

async function loadDbCardsForSet(setId: string, setName: string) {
  const out: Array<{ catalog_id: string; name: string }> = [];
  const pageSize = 500;
  for (let page = 0; page < 20; page += 1) {
    let { data, error } = await supabase
      .from("tcg_catalog_cards")
      .select("catalog_id,name")
      .eq("franchise", "pokemon")
      .eq("set_code", setId)
      .order("card_number", { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) throw error;
    if (!data?.length) {
      ({ data, error } = await supabase
        .from("tcg_catalog_cards")
        .select("catalog_id,name")
        .eq("franchise", "pokemon")
        .eq("set_name", setName)
        .order("card_number", { ascending: true })
        .range(page * pageSize, (page + 1) * pageSize - 1));
      if (error) throw error;
    }
    if (!data?.length) break;
    for (const row of data) {
      const id = String(row.catalog_id ?? "").trim();
      if (id) out.push({ catalog_id: id, name: String(row.name ?? id) });
    }
    if (data.length < pageSize) break;
  }
  return out;
}

async function countRecentSoldComps(catalogId: string): Promise<number> {
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const { count, error } = await supabase
    .from("pgt_market_comps")
    .select("id", { count: "exact", head: true })
    .eq("catalog_id", catalogId)
    .eq("kind", "sold")
    .gte("observed_at", since);
  if (error) return 0;
  return count ?? 0;
}

async function pruneOldSoldComps(catalogId: string): Promise<void> {
  const before = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  await supabase
    .from("pgt_market_comps")
    .delete()
    .eq("catalog_id", catalogId)
    .eq("kind", "sold")
    .not("observed_at", "is", null)
    .lt("observed_at", before);
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
    const label = `${row.catalog_id} · ${row.name}`;

    if (dryRun) {
      log(`  [dry-run] ${i + 1}/${dbCards.length} ${label}`);
      continue;
    }

    if (skipFresh && !force) {
      const recentSold = await countRecentSoldComps(row.catalog_id);
      if (recentSold >= minFreshSold) {
        state.stats.cardsSkippedFresh += 1;
        log(`  ${i + 1}/${dbCards.length} ${label} — skip (${recentSold} sold comps ≤${lookbackDays}d)`);
        state.cursor = { setId, cardIndex: i + 1 };
        saveState(state);
        continue;
      }
    }

    try {
      if (pruneOld) await pruneOldSoldComps(row.catalog_id);

      const result = await ingestCatalogMarketIntel(row.catalog_id, {
        profile: "full",
        soldLookbackDays: lookbackDays,
      });

      state.stats.cardsProcessed += 1;
      if (result.pricesRefreshed) state.stats.pricesRefreshed += 1;

      if (result.ok && result.comps > 0) {
        state.stats.cardsWithComps += 1;
        state.stats.soldCompsWritten += result.comps;
        log(
          `  ${i + 1}/${dbCards.length} ${label} — comps=${result.comps} prices=${result.pricesRefreshed ? "yes" : "no"}`,
        );
      } else if (result.ok) {
        state.stats.cardsEmpty += 1;
        log(`  ${i + 1}/${dbCards.length} ${label} — no comps`);
      } else {
        state.stats.failures += 1;
        logFailure({
          setId,
          catalogId: row.catalog_id,
          name: row.name,
          error: result.error ?? "ingest_failed",
        });
        log(`  ${i + 1}/${dbCards.length} ${label} — FAIL: ${result.error ?? "ingest_failed"}`);
      }
    } catch (err) {
      state.stats.failures += 1;
      const message = err instanceof Error ? err.message : String(err);
      logFailure({ setId, catalogId: row.catalog_id, name: row.name, error: message });
      log(`  ${i + 1}/${dbCards.length} ${label} — FAIL: ${message}`);
    }

    state.cursor = { setId, cardIndex: i + 1 };
    saveState(state);
    await sleep(delayMs);
  }

  if (!dryRun) {
    if (refreshSetInsights) {
      try {
        const insight = await rebuildSetInsightForSet(setId, {
          skipPriceSync: true,
          refreshAi: false,
        });
        if (insight.insightReady) state.stats.setInsightsRefreshed += 1;
        log(
          `SET ${setId} — insight ${insight.insightReady ? "cached" : "pending"}${insight.error ? ` (${insight.error})` : ""}`,
        );
      } catch (e) {
        log(
          `SET ${setId} — insight refresh failed: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }

    state.completedSets.push(setId);
    state.cursor = null;
    state.stats.setsDone += 1;
    saveState(state);
    log(`SET ${setId} — complete`);
    if (setPauseMs > 0) await sleep(setPauseMs);
  }
}

async function main() {
  const readiness = printReadiness();
  if (!readiness.pcReady && !readiness.ebayReady && !dryRun) {
    console.error(
      "No sold-comp sources ready. Set PRICECHARTING (API or Bright Data scrape) and/or eBay sold — npm run verify:pricecharting && npm run verify:ebay-sold",
    );
    process.exit(1);
  }
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
    `FMV backfill — ${queue.length} set(s) | lookback=${lookbackDays}d | skipFresh=${skipFresh} pruneOld=${pruneOld} setInsights=${refreshSetInsights} | delay=${delayMs}ms`,
  );

  for (const setMeta of queue) {
    await processSet(setMeta, state);
  }

  log(
    `Done. sets=${state.stats.setsDone}/${state.stats.setsTotal} cards=${state.stats.cardsProcessed} skippedFresh=${state.stats.cardsSkippedFresh} withComps=${state.stats.cardsWithComps} empty=${state.stats.cardsEmpty} failures=${state.stats.failures} setInsights=${state.stats.setInsightsRefreshed}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
