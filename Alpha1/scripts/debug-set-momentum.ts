/**
 * Server-side momentum audit for a set.
 * npx tsx scripts/debug-set-momentum.ts me2
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

async function main() {
  const setId = process.argv[2]?.trim() || "me2";
  const { loadSetCardsForCatalogInsight } = await import(
    "../src/lib/catalog/build-catalog-set-insight"
  );
  const { hydrateSetUsMomentum } = await import("../src/lib/market/hydrate-catalog-momentum");
  const { cardInsightRow, pricesForInsightCard } = await import(
    "../src/lib/catalog/set-insight-utils"
  );
  const { resolveCatalogMomentum } = await import("../src/lib/market/catalog-momentum");
  const { isPokeTraceConfigured } = await import("../src/lib/market/env-market");

  console.log("setId:", setId);
  console.log("PokeTrace configured:", isPokeTraceConfigured());

  let { cards } = await loadSetCardsForCatalogInsight(setId);
  console.log("cards loaded:", cards.length);

  let us = 0;
  let eu = 0;
  let none = 0;
  const sampleNone: string[] = [];
  for (const c of cards) {
    const mom = resolveCatalogMomentum(pricesForInsightCard(c));
    if (mom.region === "us") us += 1;
    else if (mom.region === "eu") eu += 1;
    else {
      none += 1;
      if (sampleNone.length < 5) sampleNone.push(c.name);
    }
  }
  console.log("BEFORE hydrate — US:", us, "EU:", eu, "none:", none, "samples:", sampleNone);

  cards = await hydrateSetUsMomentum(cards, { limit: 12, delayMs: 0 });
  us = eu = none = 0;
  const movers: Array<{ name: string; pct: number; label: string; region: string }> = [];
  for (const c of cards) {
    const row = cardInsightRow(c);
    const mom = resolveCatalogMomentum(pricesForInsightCard(c));
    if (mom.region === "us") us += 1;
    else if (mom.region === "eu") eu += 1;
    else none += 1;
    if (row.momentumPct != null && row.momentumPct !== 0) {
      movers.push({
        name: row.name,
        pct: row.momentumPct,
        label: row.momentumLabel ?? mom.label,
        region: mom.region ?? "?",
      });
    }
  }
  movers.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
  console.log("AFTER hydrate(12) — US:", us, "EU:", eu, "none:", none, "with momentum:", movers.length);
  for (const m of movers.slice(0, 8)) {
    console.log(`  ${m.pct > 0 ? "+" : ""}${m.pct}%`, m.name, "|", m.label, "|", m.region);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
