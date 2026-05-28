/**
 * Fetch live TCGPlayer/Cardmarket prices for a full Pokémon set (pokemontcg.io v2).
 */

import { pricesJsonForPokemonCatalogCard } from "./catalog-price-snapshot.mjs";

export function pokemonTcgHeaders() {
  const key = process.env.POKEMON_TCG_API_KEY?.trim();
  return key
    ? { Accept: "application/json", "X-Api-Key": key }
    : { Accept: "application/json" };
}

export function priceDelayMs() {
  return Math.max(80, Number(process.env.POKEMON_TCG_PRICE_DELAY_MS ?? 220) || 220);
}

export async function fetchJsonWithRetry(url, init = {}, options = {}) {
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

/** All cards in set with tcgplayer/cardmarket from live API. */
export async function fetchPokemonSetCardsFromApi(setId, options = {}) {
  const headers = options.headers ?? pokemonTcgHeaders();
  const delayMs = options.delayMs ?? priceDelayMs();
  const out = [];
  let page = 1;
  const pageSize = 250;

  for (;;) {
    const q = encodeURIComponent(`set.id:${setId}`);
    const url = `https://api.pokemontcg.io/v2/cards?q=${q}&page=${page}&pageSize=${pageSize}`;
    const payload = await fetchJsonWithRetry(
      url,
      { headers },
      { label: `Pokemon cards ${setId} p${page}`, timeoutMs: 60_000 },
    );
    const batch = payload?.data ?? [];
    out.push(...batch);
    const total = Number(payload?.totalCount ?? 0);
    if (!batch.length || out.length >= total || page * pageSize >= total) break;
    page += 1;
    await new Promise((r) => setTimeout(r, delayMs));
  }

  return out;
}

/** Map catalog_id → live API card for a set. */
export async function fetchPokemonSetPriceMap(setId, options = {}) {
  const cards = await fetchPokemonSetCardsFromApi(setId, options);
  const byId = new Map();
  for (const card of cards) {
    if (card?.id) byId.set(card.id, card);
  }
  return byId;
}

/**
 * Merge live API prices into catalog upsert rows (github/static + API).
 * @param {Array<Record<string, unknown>>} rows — must include catalog_id, raw_json.pokemonId
 */
export function applyPokemonApiPricesToRows(rows, apiById) {
  let priced = 0;
  for (const row of rows) {
    const pokemonId = row.raw_json?.pokemonId ?? row.catalog_id;
    const apiCard = apiById.get(pokemonId);
    row.prices_json = pricesJsonForPokemonCatalogCard(
      { id: pokemonId, tcgplayer: apiCard?.tcgplayer },
      apiCard ?? null,
    );
    const rows_ = row.prices_json?.tcgPlayerPrices;
    if (Array.isArray(rows_) && rows_.some((r) => r?.market != null || r?.mid != null)) {
      priced += 1;
    }
  }
  return priced;
}
