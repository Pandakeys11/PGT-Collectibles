/**
 * One-shot setup: JPN artwork sync, catalog prices, FMV comps for Live Market.
 *
 * Usage:
 *   node scripts/setup-uniform-market.mjs
 *   node scripts/setup-uniform-market.mjs --skip-migrations --skip-ingest
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./load-env-local.mjs";
import { spawn } from "node:child_process";

loadEnvLocal();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const skipMigrations = process.argv.includes("--skip-migrations");
const skipIngest = process.argv.includes("--skip-ingest");
const ingestOnly = process.argv.includes("--ingest-only");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const pokemonKey = process.env.POKEMON_TCG_API_KEY?.trim();
const cronSecret = process.env.CRON_SECRET?.trim();
const appUrl = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3002").replace(/\/$/, "");

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const LIQUID_SET_CODES = ["swsh9", "swsh12", "sv1", "sv3pt5", "sv3", "neo2", "base1"];

function runNpm(script, extraArgs = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.platform === "win32" ? "npm.cmd" : "npm",
      ["run", script, ...extraArgs],
      { cwd: root, stdio: "inherit", shell: true },
    );
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${script} exited ${code}`));
    });
  });
}

async function tableOk(name) {
  const { error } = await supabase.from(name).select("id").limit(1);
  return !error;
}

async function ensureMigrations() {
  if (skipMigrations) return;
  if (!(await tableOk("pgt_market_comps"))) await runNpm("db:apply:market-intel");
  if (!(await tableOk("tcg_catalog_localized_artwork"))) await runNpm("db:apply:localized-artwork");
}

function loadManifestCatalogIds() {
  const manifestPath = path.join(root, "src", "data", "pokedex", "japanese-artwork-overlays.json");
  if (!existsSync(manifestPath)) return [];
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  return [...new Set((manifest.rows ?? []).map((r) => r.baseCatalogId).filter(Boolean))];
}

async function topChaseIdsForSet(setCode) {
  const { data } = await supabase
    .from("tcg_catalog_cards")
    .select("catalog_id,rarity,card_number")
    .eq("franchise", "pokemon")
    .eq("set_code", setCode)
    .limit(400);
  if (!data?.length) return [];

  const chase = /secret|illustration|ultra|hyper|double rare|vmax|vstar|\bex\b/i;
  return data
    .map((row) => {
      const num = Number.parseInt(String(row.card_number ?? "").split("/")[0], 10) || 0;
      let score = num;
      if (chase.test(String(row.rarity ?? ""))) score += 500;
      return { id: row.catalog_id, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((r) => r.id);
}

function priceSnapshotFromApiCard(card) {
  const tp = card.tcgplayer;
  const tcgPlayerPrices = tp?.prices
    ? Object.entries(tp.prices).map(([variant, block]) => ({
        variant,
        market: block.market ?? null,
        mid: block.mid ?? null,
        low: block.low ?? null,
        high: block.high ?? null,
        directLow: null,
      }))
    : [];
  const cm = card.cardmarket?.prices;
  const cardMarket = cm
    ? {
        averageSellPrice: cm.averageSellPrice ?? null,
        trendPrice: cm.trendPrice ?? null,
        lowPrice: cm.lowPrice ?? null,
        avg7: cm.avg7 ?? null,
        avg30: cm.avg30 ?? null,
        reverseHoloTrend: cm.reverseHoloTrend ?? null,
      }
    : null;
  return {
    tcgPlayerUrl: tp?.url ?? null,
    tcgPlayerUpdatedAt: tp?.updatedAt ?? null,
    tcgPlayerPrices,
    cardMarketUrl: card.cardmarket?.url ?? null,
    cardMarketUpdatedAt: card.cardmarket?.updatedAt ?? null,
    cardMarket,
  };
}

async function refreshCatalogPrices(catalogId) {
  const { data: row } = await supabase
    .from("tcg_catalog_cards")
    .select("catalog_id,name,set_name,set_code,card_number,year,rarity,image_small_url,image_large_url,raw_json")
    .eq("catalog_id", catalogId)
    .maybeSingle();
  if (!row) return false;

  const pokemonId = row.raw_json?.pokemonId ?? catalogId;
  const headers = { Accept: "application/json" };
  if (pokemonKey) headers["X-Api-Key"] = pokemonKey;

  const res = await fetch(`https://api.pokemontcg.io/v2/cards/${encodeURIComponent(pokemonId)}`, {
    headers,
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (!res?.ok) return false;
  const body = await res.json().catch(() => null);
  const apiCard = body?.data;
  if (!apiCard?.tcgplayer?.prices && !apiCard?.cardmarket?.prices) return false;

  const pricesJson = priceSnapshotFromApiCard(apiCard);
  const { error } = await supabase.from("tcg_catalog_cards").upsert(
    {
      franchise: "pokemon",
      catalog_id: catalogId,
      name: row.name,
      set_name: row.set_name,
      set_code: row.set_code,
      card_number: row.card_number,
      year: row.year,
      rarity: row.rarity,
      image_small_url: row.image_small_url,
      image_large_url: row.image_large_url,
      prices_json: pricesJson,
      raw_json: { ...(row.raw_json ?? {}), pokemonId },
      source_id: "pokemontcg.io",
      synced_at: new Date().toISOString(),
    },
    { onConflict: "franchise,catalog_id" },
  );
  return !error;
}

async function ingestViaApi(catalogId, attempt = 0) {
  if (!cronSecret) return { ok: false, error: "no_cron_secret" };
  const q = new URL(`${appUrl}/api/jobs/market-ingest`);
  q.searchParams.set("secret", cronSecret);
  q.searchParams.set("catalogId", catalogId);
  const res = await fetch(q.toString(), { signal: AbortSignal.timeout(120_000) }).catch(() => null);
  if (!res?.ok) {
    if (attempt < 2 && (res?.status === 500 || res?.status === 503 || !res)) {
      await new Promise((r) => setTimeout(r, 2_500));
      return ingestViaApi(catalogId, attempt + 1);
    }
    return { ok: false, error: `http_${res?.status ?? 0}` };
  }
  const body = await res.json().catch(() => ({}));
  const row = body.results?.[0];
  return { ok: Boolean(row?.ok), comps: row?.comps ?? 0, error: row?.error };
}

async function waitForDev(maxMs = 90_000) {
  const probe = new URL(`${appUrl}/api/jobs/market-ingest`);
  probe.searchParams.set("secret", "__probe__");
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(probe.toString(), { signal: AbortSignal.timeout(5_000) });
      // Route exists when CRON auth rejects (401), not when Next returns 404.
      if (res.status === 401 || res.ok) return true;
    } catch {
      /* server starting */
    }
    await new Promise((r) => setTimeout(r, 2_000));
  }
  return false;
}

async function main() {
  console.log("=== Uniform market + JPN artwork setup ===\n");

  await ensureMigrations();

  const catalogIds = new Set(loadManifestCatalogIds());
  for (const setCode of LIQUID_SET_CODES) {
    for (const id of await topChaseIdsForSet(setCode)) catalogIds.add(id);
  }
  const targets = [...catalogIds];

  if (!ingestOnly) {
    console.log("1) Build + sync Japanese artwork overlays…");
    await runNpm("catalog:refresh:pokemon-japanese-artwork");

    console.log(`\n2) Refresh TCGdex/TCGPlayer prices (${targets.length} cards)…`);
    let pricesOk = 0;
    for (const catalogId of targets) {
      const ok = await refreshCatalogPrices(catalogId);
      if (ok) pricesOk += 1;
      process.stdout.write(ok ? "." : "x");
      await new Promise((r) => setTimeout(r, 150));
    }
    console.log(`\n   ${pricesOk}/${targets.length} updated`);
  } else {
    console.log(`Ingest-only mode (${targets.length} showcase cards)…`);
  }

  if (!skipIngest) {
    if (!cronSecret) {
      console.warn("\n[WARN] CRON_SECRET missing — skipping FMV ingest.");
    } else {
      console.log(`\n3) FMV ingest via ${appUrl} (needs dev server)…`);
      console.log("   Waiting for server…");
      const up = await waitForDev();
      if (!up) {
        console.warn("   Server not reachable. Start: npm run dev:clean");
        console.warn("   Then run per card: npm run market:ingest -- <catalogId>");
      } else {
        let ingestOk = 0;
        let comps = 0;
        for (const catalogId of targets) {
          const result = await ingestViaApi(catalogId);
          if (result.ok) {
            ingestOk += 1;
            comps += result.comps ?? 0;
            process.stdout.write(".");
          } else process.stdout.write("x");
          await new Promise((r) => setTimeout(r, 2_500));
        }
        console.log(`\n   ${ingestOk}/${targets.length} ok · ${comps} comps`);
      }
    }
  }

  if (!ingestOnly) {
    console.log("\n4) Verify JPN ticker…");
    await runNpm("verify:jpn-artwork-ticker");
  }

  const sampleId = targets[0] ?? "sv3pt5-204";
  const { data: priceRow } = await supabase
    .from("tcg_catalog_cards")
    .select("prices_json")
    .eq("catalog_id", sampleId)
    .maybeSingle();
  const { count: compCount } = await supabase
    .from("pgt_market_comps")
    .select("*", { count: "exact", head: true })
    .eq("catalog_id", sampleId);

  const hasPrices =
    Array.isArray(priceRow?.prices_json?.tcgPlayerPrices) &&
    priceRow.prices_json.tcgPlayerPrices.length > 0;

  console.log("\n=== Summary ===");
  console.log(`Targets: ${targets.length} showcase cards`);
  console.log(`${sampleId}: tcgPlayerPrices=${hasPrices ? "yes" : "no"} · comps=${compCount ?? 0}`);
  console.log("\nRestart: npm run dev:clean");
  console.log("Live Market: hard refresh (cache v5) or GET /api/market/live-ticker?refresh=1");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
