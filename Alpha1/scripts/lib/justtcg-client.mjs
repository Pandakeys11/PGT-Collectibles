/**
 * JustTCG client — mirrors src/lib/market/justtcg/client.ts
 */

const DEFAULT_BASE = "https://api.justtcg.com/v1";

export function getJustTcgApiKey() {
  return (
    process.env.JUSTTCG_API_KEY?.trim() ||
    process.env.Just_Pokemon_TCG_API_KEY?.trim() ||
    process.env.JUST_POKEMON_TCG_API_KEY?.trim() ||
    null
  );
}

export function getJustTcgBaseUrl() {
  return (process.env.JUSTTCG_BASE_URL?.trim() || DEFAULT_BASE).replace(/\/$/, "");
}

export function isJustTcgConfigured() {
  if (process.env.JUSTTCG_ENABLED === "0") return false;
  return Boolean(getJustTcgApiKey());
}

async function parseResponse(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { error: text.slice(0, 200) || res.statusText };
  }
}

export async function justTcgBatchLookupCards(items) {
  const apiKey = getJustTcgApiKey();
  if (!apiKey || !items.length) {
    return { cards: [], usage: null, error: items.length ? "missing_api_key" : null };
  }

  const res = await fetch(`${getJustTcgBaseUrl()}/cards`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({ cards: items }),
    signal: AbortSignal.timeout(14_000),
  });
  const body = await parseResponse(res);
  if (!res.ok) {
    return {
      cards: body.data ?? [],
      usage: body.usage ?? body.meta,
      error: body.error ?? body.code ?? `http_${res.status}`,
    };
  }
  return { cards: body.data ?? [], usage: body.usage ?? body.meta, error: null };
}

export async function justTcgGetCards(params) {
  const apiKey = getJustTcgApiKey();
  if (!apiKey) return { cards: [], usage: null, error: "missing_api_key" };

  const url = new URL(`${getJustTcgBaseUrl()}/cards`);
  for (const [key, value] of Object.entries(params)) {
    if (value != null && String(value).length) url.searchParams.set(key, String(value));
  }

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json", "x-api-key": apiKey },
    signal: AbortSignal.timeout(14_000),
  });
  const body = await parseResponse(res);
  if (!res.ok) {
    return {
      cards: body.data ?? [],
      usage: body.usage ?? body.meta,
      error: body.error ?? body.code ?? `http_${res.status}`,
    };
  }
  return { cards: body.data ?? [], usage: body.usage ?? body.meta, error: null };
}
