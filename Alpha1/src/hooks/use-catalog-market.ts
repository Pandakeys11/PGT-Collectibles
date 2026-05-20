"use client";

import { useEffect, useState } from "react";
import type { CatalogMarketSnapshot } from "@/lib/pokedex/catalog-market-snapshot";
import type { EbayGradeHub, EbayGradeHubKey, MarketSourceLink } from "@/lib/market/sources";

export type CatalogMarketPayload = {
  cardId: string;
  snapshot: CatalogMarketSnapshot;
  marketSourceLinks: MarketSourceLink[];
  ebayGradeHubs?: Record<EbayGradeHubKey, EbayGradeHub>;
};

type CacheEntry = {
  at: number;
  data?: CatalogMarketPayload;
  error?: string;
  promise?: Promise<CatalogMarketPayload>;
};

const CACHE_TTL_MS = 12 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

function cacheKey(catalogId: string, printingHint: string): string {
  return `${catalogId}|${printingHint}`;
}

async function fetchCatalogMarket(catalogId: string, printingHint: string): Promise<CatalogMarketPayload> {
  const ph = printingHint ? `&printing=${encodeURIComponent(printingHint)}` : "";
  const response = await fetch(`/api/pokedex/market?id=${encodeURIComponent(catalogId)}${ph}`);
  const body = (await response.json().catch(() => ({}))) as CatalogMarketPayload & { error?: string };
  if (!response.ok) throw new Error(body.error || `Market request failed (${response.status})`);
  return body;
}

function loadCatalogMarket(catalogId: string, printingHint: string): Promise<CatalogMarketPayload> {
  const key = cacheKey(catalogId, printingHint);
  const now = Date.now();
  const hit = cache.get(key);
  if (hit?.data && now - hit.at < CACHE_TTL_MS) return Promise.resolve(hit.data);
  if (hit?.promise) return hit.promise;

  const promise = fetchCatalogMarket(catalogId, printingHint)
    .then((data) => {
      cache.set(key, { at: Date.now(), data });
      return data;
    })
    .catch((e: unknown) => {
      const message = e instanceof Error ? e.message : "Failed to load catalog market";
      cache.set(key, { at: Date.now(), error: message });
      throw e;
    });

  cache.set(key, { at: now, promise });
  return promise;
}

export function useCatalogMarket(
  catalogId: string | null | undefined,
  options?: { enabled?: boolean; printingHint?: string | null },
): {
  payload: CatalogMarketPayload | null;
  loading: boolean;
  error: string | null;
} {
  const enabled = options?.enabled !== false;
  const printingHint = options?.printingHint?.trim() ?? "";
  const id = catalogId?.trim() ?? "";

  const [payload, setPayload] = useState<CatalogMarketPayload | null>(() => {
    if (!id || !enabled) return null;
    const hit = cache.get(cacheKey(id, printingHint));
    return hit?.data ?? null;
  });
  const [loading, setLoading] = useState(() => Boolean(id && enabled && !payload));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !enabled) {
      setPayload(null);
      setLoading(false);
      setError(null);
      return;
    }

    const key = cacheKey(id, printingHint);
    const hit = cache.get(key);
    if (hit?.data && Date.now() - hit.at < CACHE_TTL_MS) {
      setPayload(hit.data);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void loadCatalogMarket(id, printingHint)
      .then((data) => {
        if (cancelled) return;
        setPayload(data);
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setPayload(null);
        setError(e instanceof Error ? e.message : "Failed to load catalog market");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, printingHint, enabled]);

  return { payload, loading, error };
}

export function catalogMarketEligible(
  catalogId: string | null | undefined,
  status: string | null | undefined,
): boolean {
  const id = catalogId?.trim();
  if (!id) return false;
  return status === "confirmed" || status === "likely";
}
