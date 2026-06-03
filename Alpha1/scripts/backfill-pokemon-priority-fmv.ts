/**
 * FMV + sold comps for chase + top-value cards only (per set).
 * Much faster than full-set FMV while powering movers/insight on key SKUs.
 *
 * Usage:
 *   npx --yes tsx scripts/backfill-pokemon-priority-fmv.ts --recent=24
 *   npx --yes tsx scripts/backfill-pokemon-priority-fmv.ts --set=me2
 *   npx --yes tsx scripts/backfill-pokemon-priority-fmv.ts --recent=12 --top-value=10 --chase=10 --days=60
 *   npx --yes tsx scripts/backfill-pokemon-priority-fmv.ts --resume
 *
 * After run (uniform):
 *   npx --yes tsx scripts/backfill-pgt-us-trends.ts --from-comps
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listCardsFromDb } from "@/lib/catalog/db-catalog-browse";
import { selectPrioritySetCards } from "@/lib/catalog/priority-set-cards";
import { parseCatalogPriceSnapshot } from "@/lib/market/catalog-reference-evidence";
import { brightDataEbayQuotaLabel } from "@/lib/market/brightdata/ebay-sold-unlocker";
import { isEbayBrowseConfigured } from "@/lib/market/env-market";
import { getMarketCapabilities } from "@/lib/market/market-capabilities";
import { getPriceChartingReadiness } from "@/lib/market/pricecharting/readiness";
import { loadPokemonSetsVintageFirst } from "@/lib/pgt-registry/market-ingest-set-queue";
import { ingestCatalogMarketIntel } from "@/lib/pgt-registry/catalog-intel-ingest";
import { seedPgtUsTicksFromMarketComps } from "@/lib/market/pgt-us-trends/seed-from-comps";
import type { CatalogCardSummary } from "@/lib/catalog/catalog-types";
import { loadEnvLocal } from "./load-env-local.mjs";

loadEnvLocal();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const TMP = path.join(ROOT, ".tmp");
const STATE_PATH = path.join(TMP, "pokemon-priority-fmv.json");

const args = process.argv.slice(2);
const resume = args.includes("--resume") || !args.includes("--reset");
const reset = args.includes("--reset");
const dryRun = args.includes("--dry-run");
const force = args.includes("--force");
const setFilter = args.find((a) => a.startsWith("--set="))?.split("=")[1]?.trim() || null;
const recentArg = args.find((a) => a.startsWith("--recent"))?.split("=")[1]?.trim();
const maxSets = recentArg
  ? Math.min(174, Math.max(1, Number(recentArg === "" ? "24" : recentArg) || 24))
  : setFilter
    ? 1
    : Math.min(174, Math.max(1, Number(process.env.FMV_PRIORITY_MAX_SETS ?? 24) || 24));

const topValueLimit = Math.max(
  1,
  Number(args.find((a) => a.startsWith("--top-value="))?.split("=")[1] ?? process.env.FMV_PRIORITY_TOP_VALUE ?? 10) ||
    10,
);
const chaseLimit = Math.max(
  1,
  Number(args.find((a) => a.startsWith("--chase="))?.split("=")[1] ?? process.env.FMV_PRIORITY_CHASE ?? 10) ||
    10,
);
const daysArg = args.find((a) => a.startsWith("--days="))?.split("=")[1]?.trim();
const lookbackDays = Math.min(
  365,
  Math.max(7, Number(daysArg ?? process.env.FMV_BACKFILL_LOOKBACK_DAYS ?? 60) || 60),
);
const delayMs = Math.max(
  300,
  Number(process.env.FMV_PRIORITY_DELAY_MS ?? process.env.FMV_BACKFILL_DELAY_MS ?? 500),
);

process.env.MARKET_MAX_EVIDENCE_AGE_DAYS = String(lookbackDays);
process.env.MARKET_SOLD_LOOKBACK_DAYS = String(lookbackDays);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

type State = {
  version: 1;
  completedSets: string[];
  stats: {
    setsDone: number;
    priorityCards: number;
    ingested: number;
    withComps: number;
    failures: number;
    ticksSeeded: number;
  };
};

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function loadState(): State {
  if (reset || !resume || !fs.existsSync(STATE_PATH)) {
    return {
      version: 1,
      completedSets: [],
      stats: { setsDone: 0, priorityCards: 0, ingested: 0, withComps: 0, failures: 0, ticksSeeded: 0 },
    };
  }
  return JSON.parse(fs.readFileSync(STATE_PATH, "utf8")) as State;
}

function saveState(state: State) {
  if (!fs.existsSync(TMP)) fs.mkdirSync(TMP, { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

async function loadSetCards(setId: string): Promise<CatalogCardSummary[]> {
  const page = await listCardsFromDb("pokemon", setId, {
    page: 1,
    pageSize: 3000,
    includeVariants: true,
  });
  if (!page?.data.length) return [];
  return page.data;
}

async function processSet(
  setId: string,
  setName: string,
  state: State,
): Promise<void> {
  if (!force && state.completedSets.includes(setId)) {
    log(`SET ${setId} — skip (completed)`);
    return;
  }

  const cards = await loadSetCards(setId);
  if (!cards.length) {
    log(`SET ${setId} — no cards`);
    state.completedSets.push(setId);
    saveState(state);
    return;
  }

  const priority = selectPrioritySetCards(cards, {
    topValueLimit,
    chaseLimit,
  });

  log(
    `SET ${setId} — ${setName} | ${cards.length} cards → ${priority.length} priority (top=${topValueLimit} chase=${chaseLimit})`,
  );

  if (dryRun) {
    for (const p of priority.slice(0, 8)) {
      log(`  [dry] ${p.catalogId} · ${p.name} · $${p.priceUsd ?? "—"} · ${p.reasons.join("+")}`);
    }
    return;
  }

  let ingested = 0;
  let withComps = 0;
  let failures = 0;

  for (let i = 0; i < priority.length; i++) {
    const p = priority[i]!;
    const label = `${p.catalogId} · ${p.name} (${p.reasons.join("+")})`;
    try {
      const result = await ingestCatalogMarketIntel(p.catalogId, {
        profile: "full",
        soldLookbackDays: lookbackDays,
      });
      ingested += 1;
      if (result.ok && result.comps > 0) {
        withComps += 1;
        log(`  ${i + 1}/${priority.length} ${label} — comps=${result.comps}`);
      } else if (result.ok) {
        log(`  ${i + 1}/${priority.length} ${label} — no comps`);
      } else {
        failures += 1;
        log(`  ${i + 1}/${priority.length} ${label} — FAIL: ${result.error ?? "ingest"}`);
      }
    } catch (e) {
      failures += 1;
      log(`  ${i + 1}/${priority.length} ${label} — FAIL: ${e instanceof Error ? e.message : e}`);
    }
    await sleep(delayMs);
  }

  const tick = await seedPgtUsTicksFromMarketComps({ setCode: setId, lookbackDays: 45 });
  state.stats.ticksSeeded += tick.written;
  state.stats.priorityCards += priority.length;
  state.stats.ingested += ingested;
  state.stats.withComps += withComps;
  state.stats.failures += failures;
  state.stats.setsDone += 1;
  state.completedSets.push(setId);
  saveState(state);
  log(`SET ${setId} — done | ticks+${tick.written} from comps`);
}

function printReadiness(): void {
  const caps = getMarketCapabilities();
  const pc = getPriceChartingReadiness();
  console.log(`Priority FMV — top ${topValueLimit} + chase ${chaseLimit} per set | lookback ${lookbackDays}d`);
  console.log(`Max sets: ${maxSets}${setFilter ? ` | filter ${setFilter}` : " | modern-first"}`);
  console.log(`eBay sold: ${caps.ebaySoldReady ? "ready" : "OFF"} (${brightDataEbayQuotaLabel()})`);
  console.log(`PriceCharting sold scrape: ${pc.soldScrapeReady ? "ready" : "OFF"}`);
  console.log(`eBay Browse: ${isEbayBrowseConfigured() ? "ready" : "OFF"}`);
  console.log("");
}

async function main() {
  printReadiness();
  const state = loadState();
  let sets = await loadPokemonSetsVintageFirst();
  sets = [...sets].reverse();

  if (setFilter) {
    sets = sets.filter((s) => s.setCode === setFilter || s.setCode.toLowerCase() === setFilter.toLowerCase());
  } else {
    sets = sets.slice(0, maxSets);
  }

  if (!sets.length) {
    console.error("No sets matched");
    process.exit(1);
  }

  log(`Queue: ${sets.length} set(s)`);

  for (const s of sets) {
    await processSet(s.setCode, s.setName, state);
  }

  log(
    `Done. sets=${state.stats.setsDone} priorityCards=${state.stats.priorityCards} ingested=${state.stats.ingested} withComps=${state.stats.withComps} failures=${state.stats.failures} ticks=${state.stats.ticksSeeded}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
