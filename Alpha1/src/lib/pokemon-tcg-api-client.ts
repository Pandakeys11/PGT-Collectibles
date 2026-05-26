/**
 * Shared Pokémon TCG API v2 fetch helpers (browse + scan catalog match).
 */

const BASE = "https://api.pokemontcg.io/v2";

export function getPokemonTcgApiKey(): string | undefined {
  return process.env.POKEMON_TCG_API_KEY?.trim() || undefined;
}

export function pokemonTcgHeaders(): HeadersInit {
  const key = getPokemonTcgApiKey();
  const h: HeadersInit = { Accept: "application/json" };
  if (key) (h as Record<string, string>)["X-Api-Key"] = key;
  return h;
}

/** Scan/match needs snappy failure; browse can wait longer. */
export function pokemonTcgTimeoutMs(kind: "scan" | "cards" | "sets"): number {
  const hasKey = Boolean(getPokemonTcgApiKey());
  switch (kind) {
    case "scan":
      return hasKey ? 28_000 : 14_000;
    case "sets":
      return hasKey ? 90_000 : 45_000;
    case "cards":
    default:
      return hasKey ? 60_000 : 35_000;
  }
}

export async function pokemonTcgFetch(
  path: string,
  init: RequestInit & { timeoutMs?: number; kind?: "scan" | "cards" | "sets" } = {},
): Promise<Response> {
  const { timeoutMs, kind = "cards", ...rest } = init;
  const url = path.startsWith("http") ? path : `${BASE}${path.startsWith("/") ? path : `/${path}`}`;
  return fetch(url, {
    ...rest,
    headers: { ...pokemonTcgHeaders(), ...(rest.headers as Record<string, string> | undefined) },
    signal: rest.signal ?? AbortSignal.timeout(timeoutMs ?? pokemonTcgTimeoutMs(kind)),
  });
}
