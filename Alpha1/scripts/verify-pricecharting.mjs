/**
 * PriceCharting smoke — REST API (token) + product-page sold scrape (Bright Data).
 * Usage: npm run verify:pricecharting
 */
import { loadEnvLocal } from "./load-env-local.mjs";

loadEnvLocal();

const { getPriceChartingReadiness } = await import(
  "../src/lib/market/pricecharting/readiness.ts"
);
const { harvestPriceChartingSoldEvidence } = await import(
  "../src/lib/market/pricecharting/harvest-sold.ts"
);
const { priceChartingAdapter } = await import("../src/lib/market/adapters/pricecharting.ts");

const sample = {
  name: "Charizard ex",
  set: "Phantasmal Flames",
  number: "125",
  franchise: "pokemon",
};

console.log("PriceCharting smoke\n");
const ready = getPriceChartingReadiness();
console.log("  API:", ready.apiReady ? "ready" : "OFF");
console.log("  Sold scrape:", ready.soldScrapeReady ? "ready" : ready.soldScrapeEnabled ? "blocked" : "OFF");
if (ready.gaps.length) console.log("  gaps:", ready.gaps.join("; "));

if (ready.apiReady) {
  const api = await priceChartingAdapter.collect(sample);
  const refs = api.evidence.filter((e) => e.kind === "reference" && e.priceUsd != null);
  console.log(`\n  REST guide rows: ${refs.length}`);
  for (const row of refs.slice(0, 4)) {
    console.log(`    · ${row.title} — $${row.priceUsd}`);
  }
  if (api.warnings?.length) console.log("  warnings:", api.warnings.join("; "));
}

if (ready.soldScrapeReady) {
  const harvest = await harvestPriceChartingSoldEvidence(sample);
  const sold = harvest.evidence.filter((e) => e.kind === "sold");
  console.log(`\n  Sold scrape rows: ${sold.length}`);
  for (const row of sold.slice(0, 5)) {
    console.log(
      `    · $${row.priceUsd} ${row.observedAt ?? "date n/a"} — ${row.source} — ${row.title.slice(0, 48)}`,
    );
  }
  if (harvest.productUrl) console.log(`  product: ${harvest.productUrl}`);
  if (harvest.looseGuideUsd != null) console.log(`  loose guide: $${harvest.looseGuideUsd}`);
}

if (!ready.productionReady) {
  console.error(
    "\nPriceCharting not ready. Set PRICECHARTING_API_TOKEN and/or Bright Data (BRIGHTDATA_API_KEY + zone).",
  );
  process.exit(1);
}

console.log("\nOK — PriceCharting paths operational.");
