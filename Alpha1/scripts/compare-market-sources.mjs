#!/usr/bin/env node
/**
 * Compare TCGPlayer, Cardmarket (EUR), and our 7d mover math for sample cards.
 * Usage: node scripts/compare-market-sources.mjs [cardId]
 * Requires POKEMON_TCG_API_KEY in .env.local (optional but higher rate limits).
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnv() {
  for (const name of [".env.local", ".env"]) {
    const p = resolve(root, name);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m || process.env[m[1]]) continue;
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

loadEnv();

const EUR_USD = Number(process.env.CARDMARKET_EUR_USD_RATE) || 1.08;
const SAMPLE_IDS = [
  "sv4-225", // Charizard ex SAR (popular mover)
  "base1-4", // Charizard Base
  "sv3pt5-151", // Mew ex
];

function momentumPct7d30d(avg7, avg30) {
  if (avg7 == null || avg30 == null || avg30 <= 0) return null;
  return Math.round(((avg7 - avg30) / avg30) * 1000) / 10;
}

async function fetchCard(id) {
  const key = process.env.POKEMON_TCG_API_KEY?.trim();
  const headers = key ? { "X-Api-Key": key } : {};
  const res = await fetch(`https://api.pokemontcg.io/v2/cards/${encodeURIComponent(id)}`, {
    headers,
  });
  if (!res.ok) throw new Error(`API ${res.status} for ${id}`);
  const body = await res.json();
  return body.data;
}

function analyze(card) {
  const tp = card.tcgplayer?.prices ?? {};
  const cm = card.cardmarket?.prices ?? {};
  const tcgMarkets = Object.entries(tp).map(([variant, p]) => ({
    variant,
    market: p?.market ?? null,
    mid: p?.mid ?? null,
  }));
  const bestTcg = Math.max(
    ...tcgMarkets.map((r) => r.market ?? r.mid ?? 0).filter((n) => n > 0),
    0,
  );
  const trendEur = cm.trendPrice ?? null;
  const avg7Eur = cm.avg7 ?? null;
  const mom = momentumPct7d30d(avg7Eur, cm.avg30 ?? null);
  const trendUsd = trendEur != null ? Math.round(trendEur * EUR_USD * 100) / 100 : null;
  const avg7Usd = avg7Eur != null ? Math.round(avg7Eur * EUR_USD * 100) / 100 : null;
  const wrongMaxUsd = Math.max(bestTcg || 0, trendEur ?? 0, avg7Eur ?? 0);

  return {
    id: card.id,
    name: card.name,
    set: card.set?.name,
    tcgUpdated: card.tcgplayer?.updatedAt ?? null,
    cmUpdated: card.cardmarket?.updatedAt ?? null,
    tcgMarkets,
    bestTcgUsd: bestTcg > 0 ? bestTcg : null,
    cardmarket: {
      trendEur,
      avg7Eur,
      avg30Eur: cm.avg30 ?? null,
      momentumPct7dVs30d: mom,
      deltaEur7dVs30d:
        avg7Eur != null && cm.avg30 != null
          ? Math.round((avg7Eur - cm.avg30) * 100) / 100
          : null,
      trendUsd,
      avg7Usd,
    },
    displayBug: {
      oldBestCatalogUsd: wrongMaxUsd > 0 ? wrongMaxUsd : null,
      note:
        wrongMaxUsd > (bestTcg || 0) + 1
          ? "OLD bestCatalogUsd used max(TCG USD, CM EUR) — inflated vs TCGPlayer"
          : "TCG max dominates or CM missing",
    },
  };
}

async function main() {
  const ids = process.argv[2] ? [process.argv[2]] : SAMPLE_IDS;
  console.log(`EUR→USD rate: ${EUR_USD}\n`);
  for (const id of ids) {
    try {
      const card = await fetchCard(id);
      const report = analyze(card);
      console.log(JSON.stringify(report, null, 2));
      console.log("---\n");
      await new Promise((r) => setTimeout(r, 350));
    } catch (e) {
      console.error(id, e.message);
    }
  }
}

main();
