/**
 * Bootstrap PGT US market trends (pgt_us_price_ticks + coverage report).
 *
 * Fast path (use what you already have):
 *   1. npm run db:apply  (includes pgt_us_price_ticks migration)
 *   2. npm run catalog:backfill:pgt-us-trends -- --all
 *
 * Full quality (dated sold comps for 7d/30d windows):
 *   npm run catalog:backfill:fmv -- --set=me2 --days=60
 *   npm run catalog:backfill:pgt-us-trends -- --from-comps
 *
 * Usage:
 *   npx --yes tsx scripts/backfill-pgt-us-trends.ts --all
 *   npx --yes tsx scripts/backfill-pgt-us-trends.ts --from-comps [--set=me2]
 *   npx --yes tsx scripts/backfill-pgt-us-trends.ts --from-catalog [--set=me2]
 *   npx --yes tsx scripts/backfill-pgt-us-trends.ts --report [--set=me2]
 *   npx --yes tsx scripts/backfill-pgt-us-trends.ts --dry-run --all
 */
import { loadSetCardsForCatalogInsight } from "@/lib/catalog/build-catalog-set-insight";
import { setMomentumCoverage } from "@/lib/catalog/set-insight-utils";
import { hydrateSetPgtUsTrends } from "@/lib/market/pgt-us-trends/hydrate-set";
import { loadPgtUsTrendsForCatalogIds } from "@/lib/market/pgt-us-trends/load-trends";
import { seedPgtUsTicksFromCatalog } from "@/lib/market/pgt-us-trends/seed-from-catalog";
import { seedPgtUsTicksFromMarketComps } from "@/lib/market/pgt-us-trends/seed-from-comps";
import { loadEnvLocal } from "./load-env-local.mjs";

loadEnvLocal();

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const fromComps = args.includes("--from-comps") || args.includes("--all");
const fromCatalog = args.includes("--from-catalog") || args.includes("--all");
const reportOnly = args.includes("--report");
const setCode = args.find((a) => a.startsWith("--set="))?.split("=")[1]?.trim() || null;
const lookbackArg = args.find((a) => a.startsWith("--days="))?.split("=")[1]?.trim();
const lookbackDays = lookbackArg ? Math.min(365, Math.max(7, Number(lookbackArg) || 45)) : 45;

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function reportSetTrendCoverage(setId: string) {
  const { cards } = await loadSetCardsForCatalogInsight(setId);
  if (!cards.length) {
    log(`  ${setId}: no catalog cards`);
    return;
  }

  const hydrated = await hydrateSetPgtUsTrends(cards);
  const coverage = setMomentumCoverage(hydrated);
  const trends = await loadPgtUsTrendsForCatalogIds(hydrated.map((c) => c.id));
  log(
    `  ${setId}: cards=${cards.length} momentum_coverage=${(coverage * 100).toFixed(1)}% pgt_us_meta=${trends.size}`,
  );
}

async function main() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  if (reportOnly) {
    log("PGT US trend coverage report");
    if (setCode) {
      await reportSetTrendCoverage(setCode);
    } else {
      log("  Pass --set=<setCode> for per-set coverage (e.g. --set=me2)");
    }
    return;
  }

  if (fromComps) {
    log(`Seeding ticks from pgt_market_comps (lookback ${lookbackDays}d)${setCode ? ` set=${setCode}` : ""}`);
    const comps = await seedPgtUsTicksFromMarketComps({
      setCode,
      lookbackDays,
      dryRun,
    });
    log(`  comps: scanned=${comps.scanned} written=${comps.written} skipped=${comps.skipped}`);
  }

  if (fromCatalog) {
    log(`Seeding ticks from tcg_catalog_cards.prices_json${setCode ? ` set=${setCode}` : ""}`);
    const cat = await seedPgtUsTicksFromCatalog({ setCode, dryRun });
    log(`  catalog: scanned=${cat.scanned} written=${cat.written} skipped=${cat.skipped}`);
  }

  if (setCode) {
    await reportSetTrendCoverage(setCode);
  } else {
    log("Done. Run with --report --set=<code> to check mover readiness for a set.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
