"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { EbayEndingSoonPayload } from "@/lib/market/ebay-ending-soon-types";

const STORAGE_KEY = "pgt.ebay-ending-soon.v1";
const FETCH_TIMEOUT_MS = 28_000;
const AUTO_REFRESH_MS = 4 * 60 * 1000;

type EbayEndingSoonContextValue = {
  payload: EbayEndingSoonPayload | null;
  listings: EbayEndingSoonPayload["listings"];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

const EbayEndingSoonContext = createContext<EbayEndingSoonContextValue | null>(null);

function readStoredPayload(): EbayEndingSoonPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EbayEndingSoonPayload;
    return parsed?.ready && parsed.listings?.length ? parsed : null;
  } catch {
    return null;
  }
}

function storePayload(body: EbayEndingSoonPayload) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(body));
  } catch {
    /* quota */
  }
}

export function EbayEndingSoonProvider({ children }: { children: ReactNode }) {
  const [payload, setPayload] = useState<EbayEndingSoonPayload | null>(() => readStoredPayload());
  const [loading, setLoading] = useState(!readStoredPayload());
  const [error, setError] = useState<string | null>(null);
  const loadGen = useRef(0);

  const load = useCallback(async (refresh = false) => {
    const gen = ++loadGen.current;
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const q = refresh ? "?refresh=1" : "";
      const res = await fetch(`/api/market/ebay-ending-soon${q}`, {
        credentials: "same-origin",
        signal: controller.signal,
      });
      const body = (await res.json()) as EbayEndingSoonPayload;
      if (gen !== loadGen.current) return;
      if (!res.ok || !body.ready) {
        throw new Error(body.error ?? `Unable to load eBay auctions (${res.status})`);
      }
      setPayload(body);
      storePayload(body);
    } catch (e) {
      if (gen !== loadGen.current) return;
      const message =
        e instanceof Error
          ? e.name === "AbortError"
            ? "eBay auctions timed out — try Retry"
            : e.message
          : "Load failed";
      const cached = readStoredPayload();
      if (cached) {
        setPayload(cached);
        setError(null);
      } else {
        setError(message);
      }
    } finally {
      window.clearTimeout(timer);
      if (gen === loadGen.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void load(true);
    }, AUTO_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [load]);

  const listings = useMemo(() => payload?.listings ?? [], [payload]);

  const value = useMemo<EbayEndingSoonContextValue>(
    () => ({
      payload,
      listings,
      loading,
      error,
      reload: () => load(true),
    }),
    [payload, listings, loading, error, load],
  );

  return (
    <EbayEndingSoonContext.Provider value={value}>{children}</EbayEndingSoonContext.Provider>
  );
}

export function useEbayEndingSoon() {
  const ctx = useContext(EbayEndingSoonContext);
  if (!ctx) {
    throw new Error("useEbayEndingSoon must be used within EbayEndingSoonProvider");
  }
  return ctx;
}
