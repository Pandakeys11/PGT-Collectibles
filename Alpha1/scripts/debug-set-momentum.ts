/**
 * Server-side momentum audit for a set.
 * npx tsx scripts/debug-set-momentum.ts me2
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

for (const name of [".env.local", ".env"]) {
  const p = resolve(process.cwd(), name);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m || process.env[m[1]]) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function main() {
  const setId = process.argv[2]?.trim() || "me2";
  const { loadSetCardsForCatalogInsight } = await import(
    "../src/lib/catalog/build-catalog-set-insight"
  );
  const { hydrateSetMomentum } = await import("../src/lib/market/hydrate-catalog-momentum");
  const { isJustTcgConfigured } = await import("../src/lib/market/env-market");
  const { cardInsightRow, pricesForInsightCard, setMomentumCoverage } = await import(
    "../src/lib/catalog/set-insight-utils"
  );
  const { resolveCatalogMomentum } = await import("../src/lib/market/catalog-momentum");
  const { isPokeTraceConfigured } = await import("../src/lib/market/env-market");
  const { buildSetMovers } = await import("../src/lib/market/build-weekly-movers");

  console.log("setId:", setId);
  console.log("PokeTrace configured:", isPokeTraceConfigured());
  console.log("JustTCG configured:", isJustTcgConfigured());

  let { cards, tcgCards } = await loadSetCardsForCatalogInsight(setId);
  console.log("cards:", cards.length, "live tcg rows:", tcgCards.length);
  console.log("momentum coverage:", (setMomentumCoverage(cards) * 100).toFixed(1) + "%");

  const top = [...cards]
    .map((c) => cardInsightRow(c))
    .filter((r) => r.priceUsd != null)
    .sort((a, b) => (b.priceUsd ?? 0) - (a.priceUsd ?? 0))
    .slice(0, 3);
  for (const row of top) {
    const card = cards.find((c) => c.id === row.catalogId)!;
    const snap = pricesForInsightCard(card);
    const mom = resolveCatalogMomentum(snap);
    console.log(
      " top:",
      row.name,
      "| cm avg7/30:",
      snap.cardMarket?.avg7,
      snap.cardMarket?.avg30,
      "| poke:",
      snap.pokeTrace?.momentumPct,
      "| mom:",
      mom.pct,
      mom.region,
    );
  }

  const topId = top[0]?.catalogId;
  if (topId) {
    const { buildPokeTraceCatalogSnapshot } = await import(
      "../src/lib/market/poketrace/build-catalog-snapshot"
    );
    const snap = await buildPokeTraceCatalogSnapshot(topId);
    console.log(
      " pokeTrace build:",
      topId,
      "| cm:",
      snap?.cardMarket?.avg7,
      snap?.cardMarket?.avg30,
      "| meta:",
      snap?.pokeTrace?.momentumPct,
      "| mom:",
      snap ? resolveCatalogMomentum(snap).pct : null,
    );
  }

  cards = await hydrateSetMomentum(cards, { limit: 40, delayMs: 0 });
  console.log("after hydrate:", (setMomentumCoverage(cards) * 100).toFixed(1) + "%");

  const movers = cards
    .map((c) => ({ row: cardInsightRow(c), mom: resolveCatalogMomentum(pricesForInsightCard(c)) }))
    .filter((x) => x.row.momentumPct != null && x.row.momentumPct !== 0)
    .sort((a, b) => Math.abs(b.row.momentumPct!) - Math.abs(a.row.momentumPct!));

  console.log("mover candidates:", movers.length);
  for (const { row, mom } of movers.slice(0, 6)) {
    console.log(`  ${row.momentumPct! > 0 ? "+" : ""}${row.momentumPct}%`, row.name, "|", mom.label);
  }

  const api = await buildSetMovers(setId, "test");
  console.log("buildSetMovers ready:", api.ready, "up:", api.increases.length, "down:", api.decreases.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
