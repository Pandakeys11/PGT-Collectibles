import type { FairValueBasis } from "@/lib/market/fair-value";
import { registerRuntimeCacheClear } from "@/lib/server/runtime-caches";
import type { ExtractedCard, MarketEvidence, MarketSourceLink } from "@/lib/scan/schemas";

export type EnrichMarketPayload = {
  marketEvidence: MarketEvidence[];
  fairValueUsd: number | null;
  fairValueBasis: FairValueBasis | null;
  marketSourceLinks: MarketSourceLink[];
};

const store = new Map<string, { storedAt: number; value: EnrichMarketPayload }>();

const DEFAULT_TTL_MS = 30 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 250;

function ttlMs(): number {
  const raw = process.env.MARKET_ENRICH_CACHE_TTL_MS?.trim();
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TTL_MS;
}

function maxEntries(): number {
  const raw = process.env.MARKET_ENRICH_CACHE_MAX?.trim();
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_MAX_ENTRIES;
}

export function enrichCacheKey(card: ExtractedCard): string {
  const stable = {
    name: card.name?.trim().toLowerCase() ?? "",
    printedName: card.printedName?.trim().toLowerCase() ?? "",
    language: card.language?.trim().toLowerCase() ?? "",
    set: card.set?.trim().toLowerCase() ?? "",
    number: card.number?.trim().toLowerCase() ?? "",
    year: card.year?.trim() ?? "",
    rarity: card.rarity?.trim().toLowerCase() ?? "",
    printStamps: card.printStamps?.trim().toLowerCase() ?? "",
    grader: card.grader?.trim().toLowerCase() ?? "",
    grade: card.grade?.trim().toLowerCase() ?? "",
    cert: card.cert?.replace(/\D/g, "") ?? "",
    details: card.details?.trim().toLowerCase() ?? "",
    extractedPrice: card.extractedPrice ?? null,
  };
  return JSON.stringify(stable);
}

export function getEnrichMarketCache(key: string): EnrichMarketPayload | null {
  if (process.env.MARKET_ENRICH_CACHE === "0") return null;
  const row = store.get(key);
  if (!row) return null;
  if (Date.now() - row.storedAt > ttlMs()) {
    store.delete(key);
    return null;
  }
  return row.value;
}

export function setEnrichMarketCache(key: string, value: EnrichMarketPayload): void {
  if (process.env.MARKET_ENRICH_CACHE === "0") return;
  while (store.size >= maxEntries()) {
    const first = store.keys().next().value;
    if (first) store.delete(first);
    else break;
  }
  store.set(key, { storedAt: Date.now(), value });
}

export function clearEnrichMarketCache(): void {
  store.clear();
}

registerRuntimeCacheClear(clearEnrichMarketCache);
