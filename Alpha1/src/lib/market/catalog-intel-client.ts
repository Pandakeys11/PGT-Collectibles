import type { PokemonMarketKnowledge } from "@/lib/market/pokemon-market-knowledge-shared";

const CACHE_TTL_MS = 90_000;
const cache = new Map<string, { at: number; data: PokemonMarketKnowledge }>();

function cacheKey(catalogId: string, lite: boolean): string {
  return `${lite ? "lite" : "full"}:${catalogId.trim()}`;
}

export function readCachedCatalogIntel(
  catalogId: string,
  lite = false,
): PokemonMarketKnowledge | null {
  const hit = cache.get(cacheKey(catalogId, lite));
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(cacheKey(catalogId, lite));
    return null;
  }
  return hit.data;
}

export function writeCachedCatalogIntel(
  catalogId: string,
  data: PokemonMarketKnowledge,
  lite = false,
): void {
  cache.set(cacheKey(catalogId, lite), { at: Date.now(), data });
}

export async function fetchCatalogMarketIntel(
  catalogId: string,
  options?: { lite?: boolean; signal?: AbortSignal },
): Promise<PokemonMarketKnowledge> {
  const id = catalogId.trim();
  if (!id) throw new Error("catalogId required");

  const lite = options?.lite === true;
  const cached = readCachedCatalogIntel(id, lite);
  if (cached) return cached;

  const q = new URLSearchParams({ catalogId: id });
  if (lite) q.set("lite", "1");
  const res = await fetch(`/api/market/intel?${q}`, {
    credentials: "same-origin",
    signal: options?.signal,
  });
  const body = (await res.json()) as PokemonMarketKnowledge & { ready?: boolean; error?: string };
  if (!res.ok || !body.ready) {
    throw new Error(body.error ?? `Market intel failed (${res.status})`);
  }
  writeCachedCatalogIntel(id, body, lite);
  if (!lite) writeCachedCatalogIntel(id, body, false);
  return body;
}
