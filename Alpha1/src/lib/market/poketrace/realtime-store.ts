import type { PokeTraceRealtimeUpdate } from "@/lib/market/poketrace/types";

const TTL_MS = 20 * 60 * 1000;
const MAX_ENTRIES = 4_000;

type Entry = PokeTraceRealtimeUpdate & { expiresAt: number };

const store = new Map<string, Entry>();

function keyFor(cardId: string, tier: string | null, source: string): string {
  return `${cardId}|${source}|${tier ?? "AGGREGATED"}`;
}

export function applyPokeTraceRealtimeUpdate(update: PokeTraceRealtimeUpdate): void {
  const k = keyFor(update.cardId, update.tier, update.source);
  store.set(k, { ...update, expiresAt: Date.now() + TTL_MS });
  if (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest) store.delete(oldest);
  }
}

export function getPokeTraceRealtimeUpdate(
  cardId: string,
  options?: { tier?: string | null; source?: string },
): PokeTraceRealtimeUpdate | null {
  pruneExpired();
  const id = cardId.trim();
  if (!id) return null;
  if (options?.source) {
    const hit = store.get(keyFor(id, options.tier ?? null, options.source));
    return hit ?? null;
  }
  for (const [k, entry] of store) {
    if (k.startsWith(`${id}|`)) return entry;
  }
  return null;
}

export function listPokeTraceRealtimeUpdates(limit = 200): PokeTraceRealtimeUpdate[] {
  pruneExpired();
  return [...store.values()]
    .sort((a, b) => b.observedAt.localeCompare(a.observedAt))
    .slice(0, limit);
}

function pruneExpired(): void {
  const now = Date.now();
  for (const [k, entry] of store) {
    if (entry.expiresAt <= now) store.delete(k);
  }
}

export function pokeTraceRealtimeStoreSize(): number {
  pruneExpired();
  return store.size;
}
