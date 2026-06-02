/** In-memory catalog API cache — instant re-open, stale-while-revalidate. */

const CACHE_TTL_MS = 45 * 60 * 1000;

type CacheEntry = { at: number; data: unknown };

const store = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

export function readCatalogCache<T>(key: string): T | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    store.delete(key);
    return null;
  }
  return hit.data as T;
}

export function writeCatalogCache(key: string, data: unknown) {
  store.set(key, { at: Date.now(), data });
}

export function peekCatalogCacheAgeMs(key: string): number | null {
  const hit = store.get(key);
  if (!hit) return null;
  return Date.now() - hit.at;
}

export async function fetchCatalogJson<T>(url: string, init?: RequestInit): Promise<T> {
  const cached = readCatalogCache<T>(url);
  if (cached != null) {
    void revalidateCatalogJson<T>(url, init).catch(() => {});
    return cached;
  }

  const pending = inflight.get(url);
  if (pending) return pending as Promise<T>;

  const task = (async () => {
    const res = await fetch(url, init);
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(err.error || `Request failed (${res.status})`);
    }
    const data = (await res.json()) as T;
    writeCatalogCache(url, data);
    return data;
  })();

  inflight.set(url, task);
  try {
    return await task;
  } finally {
    inflight.delete(url);
  }
}

async function revalidateCatalogJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, init);
    if (!res.ok) return null;
    const data = (await res.json()) as T;
    writeCatalogCache(url, data);
    return data;
  } catch {
    return null;
  }
}

/** Warm common catalog endpoints after Liquid Scan loads. */
export function prefetchMasterCatalogDefaults() {
  if (typeof window === "undefined") return;

  const warm = [
    "/api/catalog/franchises",
    "/api/pokedex/sets?page=1&pageSize=40&orderBy=-releaseDate&era=modern",
  ];

  for (const url of warm) {
    if (readCatalogCache(url)) continue;
    void fetchCatalogJson(url).catch(() => {});
  }
}
