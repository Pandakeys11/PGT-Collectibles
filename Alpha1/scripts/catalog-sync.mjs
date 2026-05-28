/**
 * Sync franchise catalog data into Supabase tcg_catalog_cards.
 *
 * Usage:
 *   node scripts/catalog-sync.mjs --franchise=magic
 *   node scripts/catalog-sync.mjs --franchise=yugioh
 *   node scripts/catalog-sync.mjs --franchise=lorcana
 *   node scripts/catalog-sync.mjs --franchise=onepiece
 *   node scripts/catalog-sync.mjs --franchise=all
 *   node scripts/catalog-sync.mjs --franchise=pokemon --skip-prices
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./load-env-local.mjs";
import {
  fetchPokemonSetPriceMap,
  applyPokemonApiPricesToRows,
  pokemonTcgHeaders,
  priceDelayMs,
} from "./lib/pokemon-set-price-hydrate.mjs";

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const franchiseArg = process.argv.find((a) => a.startsWith("--franchise="))?.split("=")[1] ?? "all";
const skipPrices = process.argv.includes("--skip-prices");

if (!url || !key) {
  console.error("Missing Supabase env vars in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

function searchText(parts) {
  return parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s/.-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeRows(rows, keyFn) {
  const map = new Map();
  for (const row of rows) {
    map.set(keyFn(row), row);
  }
  return [...map.values()];
}

async function fetchJsonWithRetry(url, init = {}, options = {}) {
  const attempts = options.attempts ?? 4;
  const label = options.label ?? url;
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const res = await fetch(url, {
        ...init,
        signal: init.signal ?? AbortSignal.timeout(options.timeoutMs ?? 45_000),
      });
      if (res.ok) return res.json();
      lastError = new Error(`${label} ${res.status}`);
      if (![408, 429, 500, 502, 503, 504].includes(res.status)) throw lastError;
    } catch (err) {
      lastError = err;
    }
    if (attempt < attempts - 1) {
      await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
    }
  }
  throw lastError ?? new Error(`${label} failed`);
}

async function upsertBatch(rows) {
  if (rows.length === 0) return 0;
  rows = dedupeRows(rows, (row) => `${row.franchise}|${row.catalog_id}`);
  const chunkSize = 200;
  let total = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from("tcg_catalog_cards").upsert(chunk, {
      onConflict: "franchise,catalog_id",
    });
    if (error) throw new Error(error.message);
    total += chunk.length;
    process.stdout.write(`  upserted ${total}/${rows.length}\r`);
  }
  console.log("");
  return total;
}

async function upsertSetsBatch(rows) {
  if (rows.length === 0) return 0;
  rows = dedupeRows(rows, (row) => `${row.franchise}|${row.external_set_id}`);
  const chunkSize = 200;
  let total = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from("tcg_catalog_sets").upsert(chunk, {
      onConflict: "franchise,external_set_id",
    });
    if (error) throw new Error(error.message);
    total += chunk.length;
  }
  return total;
}

function setRow(franchise, externalSetId, name, code, releaseDate, cardCount, sourceId, rawJson = {}) {
  return {
    franchise,
    external_set_id: externalSetId,
    name,
    code: code ?? null,
    release_date: releaseDate ?? null,
    card_count: cardCount ?? null,
    source_id: sourceId,
    raw_json: rawJson,
    synced_at: new Date().toISOString(),
  };
}

async function touchSource(sourceId) {
  await supabase
    .from("tcg_catalog_sources")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", sourceId);
}

async function syncMagic() {
  console.log("Sync Magic (Scryfall bulk data, paper expansions)...");
  const headers = { "User-Agent": "PGTVision/1.0 catalog-sync" };
  const setsPayload = await fetchJsonWithRetry(
    "https://api.scryfall.com/sets",
    { headers },
    { label: "Scryfall sets", timeoutMs: 45_000 },
  );
  const sets = (setsPayload?.data ?? []).filter(
    (s) => s.digital === false && (s.set_type === "expansion" || s.set_type === "core" || s.set_type === "masters"),
  );
  const setRows = sets.map((s) =>
    setRow("magic", s.code, s.name, s.code, s.released_at ?? null, s.card_count ?? null, "scryfall.com", {
      scryfallId: s.id,
      set_type: s.set_type,
    }),
  );
  const setsUpserted = await upsertSetsBatch(setRows);
  console.log(`  Magic sets indexed: ${setsUpserted}`);

  const bulkPayload = await fetchJsonWithRetry(
    "https://api.scryfall.com/bulk-data",
    { headers },
    { label: "Scryfall bulk index", timeoutMs: 45_000 },
  );
  const bulkType = process.env.MAGIC_SYNC_BULK_TYPE?.trim() || "unique_artwork";
  const bulk = (bulkPayload?.data ?? []).find((row) => row.type === bulkType);
  if (!bulk?.download_uri) throw new Error(`Scryfall bulk ${bulkType} unavailable`);
  console.log(`  Magic bulk source: ${bulkType} (${Math.round((bulk.size ?? 0) / 1024 / 1024)} MB)`);

  const cards = await fetchJsonWithRetry(
    bulk.download_uri,
    { headers },
    { label: `Scryfall bulk ${bulkType}`, timeoutMs: 300_000 },
  );
  const setCodes = new Set(sets.map((set) => set.code));
  const rows = (Array.isArray(cards) ? cards : [])
    .filter((card) => setCodes.has(card.set) && (card.games ?? []).includes("paper"))
    .map((card) => ({
      franchise: "magic",
      catalog_id: `scryfall:${card.id}`,
      name: card.name,
      printed_name: card.printed_name ?? null,
      set_name: card.set_name ?? null,
      set_code: card.set ?? null,
      card_number: card.collector_number ?? null,
      year: card.released_at?.slice(0, 4) ?? null,
      rarity: card.rarity ?? null,
      image_small_url: card.image_uris?.small ?? card.card_faces?.[0]?.image_uris?.small ?? null,
      image_large_url: card.image_uris?.large ?? card.card_faces?.[0]?.image_uris?.large ?? null,
      search_text: searchText([card.name, card.set_name, card.collector_number]),
      prices_json: { tcgPlayerUrl: card.purchase_uris?.tcgplayer ?? null },
      raw_json: { scryfallId: card.id, setCode: card.set },
      source_id: "scryfall.com",
      synced_at: new Date().toISOString(),
    }));
  const count = await upsertBatch(rows);
  await touchSource("scryfall.com");
  console.log(`Magic: ${count} cards`);
}

async function syncYugioh() {
  console.log("Sync Yu-Gi-Oh (YGOPRODeck archive)...");
  const cardsets = await fetch("https://db.ygoprodeck.com/api/v7/cardsets.php").then((r) => r.json());
  const ygoSetRows = (cardsets ?? []).map((s) =>
    setRow(
      "yugioh",
      s.set_code,
      s.set_name,
      s.set_code,
      s.tcg_date ?? null,
      s.num_of_cards ?? null,
      "ygoprodeck.com",
    ),
  );
  console.log(`  Yu-Gi-Oh sets indexed: ${await upsertSetsBatch(ygoSetRows)}`);

  const probe = await fetch(
    "https://db.ygoprodeck.com/api/v7/cardinfo.php?num=1&offset=0",
  ).then((r) => r.json());
  const total = Number(probe?.meta?.total_rows ?? 0);
  if (!total) {
    console.log("Yu-Gi-Oh: 0 cards (archive meta unavailable)");
    return;
  }
  const rows = [];
  const pageSize = 100;
  for (let offset = 0; offset < total; offset += pageSize) {
    const payload = await fetch(
      `https://db.ygoprodeck.com/api/v7/cardinfo.php?num=${pageSize}&offset=${offset}`,
    ).then((r) => r.json());
    for (const card of payload?.data ?? []) {
      const setRow = card.card_sets?.[0];
      rows.push({
        franchise: "yugioh",
        catalog_id: `ygo:${card.id}${setRow?.set_code ? `:${setRow.set_code}` : ""}`,
        name: card.name,
        printed_name: null,
        set_name: setRow?.set_name ?? null,
        set_code: setRow?.set_code ?? null,
        card_number: setRow?.set_code ?? null,
        year: null,
        rarity: setRow?.set_rarity ?? null,
        image_small_url: card.card_images?.[0]?.image_url_small ?? card.card_images?.[0]?.image_url ?? null,
        image_large_url: card.card_images?.[0]?.image_url ?? null,
        search_text: searchText([card.name, setRow?.set_name, setRow?.set_code]),
        prices_json: {},
        raw_json: { ygoId: card.id },
        source_id: "ygoprodeck.com",
        synced_at: new Date().toISOString(),
      });
    }
    await new Promise((r) => setTimeout(r, 60));
  }
  const count = await upsertBatch(rows);
  await touchSource("ygoprodeck.com");
  console.log(`Yu-Gi-Oh: ${count} cards`);
}

async function syncLorcana() {
  console.log("Sync Lorcana (Lorcast sets + per-set search)...");
  const setsPayload = await fetch("https://api.lorcast.com/v0/sets").then((r) => {
    if (!r.ok) throw new Error(`Lorcast sets ${r.status}`);
    return r.json();
  });
  const sets = setsPayload?.results ?? [];
  const setRows = sets.map((s) =>
    setRow("lorcana", s.code, s.name, s.code, s.released_at ?? null, null, "lorcast.com", {
      lorcastSetId: s.id,
    }),
  );
  await upsertSetsBatch(setRows);

  const rows = [];
  for (const set of sets) {
    const q = encodeURIComponent(`set:${set.code}`);
    const search = await fetch(`https://api.lorcast.com/v0/cards/search?q=${q}`).then((r) =>
      r.json(),
    );
    for (const card of search?.results ?? []) {
      const name = card.version ? `${card.name} — ${card.version}` : card.name;
      const imgs = card.image_uris?.digital;
      rows.push({
        franchise: "lorcana",
        catalog_id: `lorcana:${card.id}`,
        name,
        printed_name: card.name ?? null,
        set_name: card.set?.name ?? set.name,
        set_code: set.code,
        card_number: String(card.collector_number ?? ""),
        year: set.released_at?.slice(0, 4) ?? null,
        rarity: card.rarity ?? null,
        image_small_url: imgs?.small ?? imgs?.normal ?? null,
        image_large_url: imgs?.large ?? imgs?.normal ?? null,
        search_text: searchText([name, set.name, card.collector_number]),
        prices_json: { tcgPlayerUrl: card.purchase_uris?.tcgplayer ?? null },
        raw_json: { lorcastId: card.id },
        source_id: "lorcast.com",
        synced_at: new Date().toISOString(),
      });
    }
    await new Promise((r) => setTimeout(r, 200));
    process.stdout.write(`  ${set.code}: ${rows.length} cards\r`);
  }
  const count = await upsertBatch(rows);
  await touchSource("lorcast.com");
  console.log(`Lorcana: ${count} cards`);
}

async function syncOnepiece() {
  console.log("Sync One Piece (OPTCG API sets)...");
  const sets = await fetch("https://optcgapi.com/api/allSets/").then((r) => r.json());
  const setRows = [];
  const rows = [];
  for (const set of sets ?? []) {
    const setId = set.set_id ?? set.id ?? set.setId;
    if (!setId) continue;
    setRows.push(
      setRow(
        "onepiece",
        String(setId),
        set.set_name ?? set.name ?? String(setId),
        String(setId),
        set.release_date ?? null,
        set.card_count ?? null,
        "optcgapi.com",
      ),
    );
    const cards = await fetch(`https://optcgapi.com/api/sets/${encodeURIComponent(setId)}/`).then(
      (r) => r.json(),
    );
    for (const card of cards ?? []) {
      const id = card.card_set_id ?? card.id;
      if (!id) continue;
      rows.push({
        franchise: "onepiece",
        catalog_id: `optcg:${id}`,
        name: card.card_name ?? card.name ?? "Unknown",
        printed_name: null,
        set_name: card.set_name ?? set.set_name ?? set.name ?? null,
        set_code: setId,
        card_number: id,
        year: null,
        rarity: card.rarity ?? null,
        image_small_url: card.card_image ?? null,
        image_large_url: card.card_image ?? null,
        search_text: searchText([card.card_name, card.set_name, id]),
        prices_json: {},
        raw_json: { setId },
        source_id: "optcgapi.com",
        synced_at: new Date().toISOString(),
      });
    }
    await new Promise((r) => setTimeout(r, 120));
  }
  await upsertSetsBatch(setRows);
  const count = await upsertBatch(rows);
  await touchSource("optcgapi.com");
  console.log(`One Piece: ${count} cards`);
}

async function syncPokemon() {
  console.log("Sync Pokémon (sets + all cards — slow, use API key if available)...");
  if (skipPrices) {
    console.log("  --skip-prices: storing URL-only prices_json (not recommended)");
  } else {
    console.log(
      "  Prices: live pokemontcg.io per set",
      process.env.POKEMON_TCG_API_KEY?.trim() ? "(API key set)" : "(no key — slower limits)",
    );
  }
  const headers = pokemonTcgHeaders();

  const setsPayload = await fetchJsonWithRetry(
    "https://api.pokemontcg.io/v2/sets?pageSize=250&orderBy=-releaseDate",
    { headers },
    { label: "Pokemon sets", timeoutMs: 60_000 },
  );
  const allSets = setsPayload.data ?? [];
  const pokemonSetsById = new Map(allSets.map((set) => [set.id, set]));
  const setRows = allSets.map((s) =>
    setRow(
      "pokemon",
      s.id,
      s.name,
      s.id,
      s.releaseDate?.replace(/\//g, "-") ?? null,
      s.total ?? s.printedTotal ?? null,
      "pokemontcg.io",
      { series: s.series, images: s.images },
    ),
  );
  console.log(`  Pokémon sets indexed: ${await upsertSetsBatch(setRows)}`);

  const files = await fetchJsonWithRetry(
    "https://api.github.com/repos/PokemonTCG/pokemon-tcg-data/contents/cards/en?ref=master",
    { headers: { "User-Agent": "PGTVision/1.0 catalog-sync" } },
    { label: "PokemonTCG data file list", timeoutMs: 60_000 },
  );
  let count = 0;
  for (const file of files ?? []) {
    if (!file?.download_url || !String(file.name ?? "").endsWith(".json")) continue;
    const cards = await fetchJsonWithRetry(
      file.download_url,
      { headers: { "User-Agent": "PGTVision/1.0 catalog-sync" } },
      { label: `PokemonTCG data ${file.name}`, timeoutMs: 60_000 },
    );
    if (!Array.isArray(cards) || cards.length === 0) continue;
    const setCode = String(file.name).replace(/\.json$/i, "");
    const setInfo = pokemonSetsById.get(setCode);
    const rows = cards.map((card) => ({
      franchise: "pokemon",
      catalog_id: card.id,
      name: card.name,
      printed_name: null,
      set_name: card.set?.name ?? setInfo?.name ?? null,
      set_code: card.set?.id ?? setCode,
      card_number: String(card.number ?? ""),
      year: card.set?.releaseDate?.slice(0, 4) ?? setInfo?.releaseDate?.slice(0, 4) ?? null,
      rarity: card.rarity ?? null,
      image_small_url: card.images?.small ?? null,
      image_large_url: card.images?.large ?? null,
      search_text: searchText([card.name, card.set?.name, card.number]),
      prices_json: { tcgPlayerUrl: card.tcgplayer?.url ?? null },
      raw_json: { pokemonId: card.id },
      source_id: "pokemontcg.io",
      synced_at: new Date().toISOString(),
    }));

    if (!skipPrices) {
      try {
        const apiById = await fetchPokemonSetPriceMap(setCode, {
          headers,
          delayMs: priceDelayMs(),
        });
        const priced = applyPokemonApiPricesToRows(rows, apiById);
        process.stdout.write(`  ${setCode}: ${rows.length} cards (${priced} priced)     \r`);
      } catch (err) {
        console.warn(`\n  ${setCode}: price hydrate failed — ${err?.message ?? err}`);
      }
    }

    count += await upsertBatch(rows);
    if (skipPrices) {
      process.stdout.write(`  ${setCode}: ${rows.length} cards (${count} total)\r`);
    }
  }
  await touchSource("pokemontcg.io");
  console.log(`Pokémon: ${count} cards`);
}

const runners = {
  pokemon: syncPokemon,
  magic: syncMagic,
  yugioh: syncYugioh,
  lorcana: syncLorcana,
  onepiece: syncOnepiece,
};

async function main() {
  const list =
    franchiseArg === "all" ? Object.keys(runners) : franchiseArg.split(",").map((s) => s.trim());
  for (const key of list) {
    const fn = runners[key];
    if (!fn) {
      console.warn(`Unknown franchise: ${key}`);
      continue;
    }
    await fn();
  }
  console.log("\nCatalog sync complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
