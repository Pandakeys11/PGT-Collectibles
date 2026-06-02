"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeSetInsightResponse } from "@/lib/catalog/normalize-set-insight-response";
import type { CatalogSetInsightPayload } from "@/lib/catalog/set-insight-payload";

const CLIENT_CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEntry = {
  at: number;
  body: CatalogSetInsightPayload;
};

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<CatalogSetInsightPayload>>();

async function fetchSetInsight(
  setId: string,
  setName: string,
  refresh: boolean,
): Promise<CatalogSetInsightPayload> {
  const key = setId.trim();
  if (!refresh) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CLIENT_CACHE_TTL_MS) {
      return hit.body;
    }
  }

  const pending = inFlight.get(key);
  if (pending && !refresh) return pending;

  const promise = (async () => {
    const q = new URLSearchParams({ setId: key });
    if (refresh) q.set("refresh", "1");
    const res = await fetch(`/api/catalog/set-insight?${q}`, { credentials: "same-origin" });
    const body = (await res.json()) as CatalogSetInsightPayload & { error?: string };
    if (!res.ok) {
      throw new Error(body.error ?? `Request failed (${res.status})`);
    }
    if (!body.setWide?.cardCount && !body.ready) {
      throw new Error(
        body.error === "insight_empty"
          ? "No prices loaded for this set — confirm POKEMON_TCG_API_KEY and run catalog sync."
          : body.error ?? "Set insight unavailable",
      );
    }
    const normalized = normalizeSetInsightResponse(body, setName);
    cache.set(key, { at: Date.now(), body: normalized });
    return normalized;
  })().finally(() => {
    inFlight.delete(key);
  });

  inFlight.set(key, promise);
  return promise;
}

/**
 * One set-insight fetch per setId — shared across binder panel, header band, and insight rail.
 */
export function useSetInsight(
  setId: string | null,
  setName: string,
  options?: { enabled?: boolean; deferMs?: number },
) {
  const enabled = options?.enabled !== false;
  const deferMs = options?.deferMs ?? 0;

  const [insight, setInsight] = useState<CatalogSetInsightPayload | null>(() => {
    if (!setId) return null;
    const hit = cache.get(setId.trim());
    return hit && Date.now() - hit.at < CLIENT_CACHE_TTL_MS ? hit.body : null;
  });
  const [loading, setLoading] = useState(() => {
    if (!setId || !enabled) return false;
    const hit = cache.get(setId.trim());
    return !(hit && Date.now() - hit.at < CLIENT_CACHE_TTL_MS);
  });
  const [error, setError] = useState<string | null>(null);
  const loadedSetIdRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!setId?.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const body = await fetchSetInsight(setId, setName, true);
      setInsight(body);
      loadedSetIdRef.current = setId;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load set insight");
      setInsight(null);
    } finally {
      setLoading(false);
    }
  }, [setId, setName]);

  useEffect(() => {
    if (!setId?.trim() || !enabled) {
      setInsight(null);
      setError(null);
      setLoading(false);
      loadedSetIdRef.current = null;
      return;
    }

    if (loadedSetIdRef.current && loadedSetIdRef.current !== setId) {
      loadedSetIdRef.current = null;
    }

    const hit = cache.get(setId.trim());
    if (hit && Date.now() - hit.at < CLIENT_CACHE_TTL_MS) {
      setInsight(hit.body);
      setLoading(false);
      setError(null);
      loadedSetIdRef.current = setId;
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const body = await fetchSetInsight(setId, setName, false);
          if (!cancelled) {
            setInsight(body);
            loadedSetIdRef.current = setId;
          }
        } catch (e) {
          if (!cancelled) {
            setError(e instanceof Error ? e.message : "Failed to load set insight");
            setInsight(null);
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, deferMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [setId, setName, enabled, deferMs]);

  return { insight, loading, error, refresh };
}
