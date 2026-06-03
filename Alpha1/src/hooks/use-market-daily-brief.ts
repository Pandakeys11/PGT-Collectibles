"use client";

import { useCallback, useEffect, useState } from "react";
import type { MarketDailyBriefPayload } from "@/lib/market/run-market-daily-brief";

const SESSION_KEY = "pgt-market-daily-brief";

let inflightRequest: Promise<MarketDailyBriefPayload> | null = null;

function readSessionCache(): MarketDailyBriefPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MarketDailyBriefPayload;
    if (!parsed.markdown) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSessionCache(body: MarketDailyBriefPayload): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(body));
  } catch {
    /* quota / private mode */
  }
}

function msUntil(iso: string): number {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 60 * 60 * 1000;
  return Math.max(5_000, t - Date.now());
}

export function useMarketDailyBrief() {
  const [data, setData] = useState<MarketDailyBriefPayload | null>(() => readSessionCache());
  const [loading, setLoading] = useState(!readSessionCache()?.markdown);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      if (!refresh && inflightRequest) {
        const body = await inflightRequest;
        if (body.markdown) {
          setData(body);
          writeSessionCache(body);
        }
        return body;
      }
      const url = refresh ? "/api/market/daily-brief?refresh=1" : "/api/market/daily-brief";
      inflightRequest = fetch(url, { cache: "no-store" })
        .then(async (res) => {
          if (!res.ok) throw new Error(`Daily brief failed (${res.status})`);
          return (await res.json()) as MarketDailyBriefPayload;
        })
        .finally(() => {
          inflightRequest = null;
        });
      const body = await inflightRequest;
      if (body.markdown) {
        const cached = readSessionCache();
        const prevKey = cached?.editionKey ?? cached?.todayUtc;
        const nextKey = body.editionKey ?? body.todayUtc;
        setData(body);
        if (refresh || prevKey !== nextKey || !cached) {
          writeSessionCache(body);
        }
      } else if (body.error) {
        setError(body.error);
      }
      return body;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Daily brief unavailable");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  useEffect(() => {
    if (!data?.nextRefreshAt) return;
    const delay = msUntil(data.nextRefreshAt);
    const timer = window.setTimeout(() => {
      void load(true);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [data?.nextRefreshAt, data?.editionKey, load]);

  return { data, loading, error, reload: () => load(true) };
}
