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
  configHint: string | null;
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
  const [configHint, setConfigHint] = useState<string | null>(null);
  const loadGen = useRef(0);

  const load = useCallback(async (refresh = false) => {
    const gen = ++loadGen.current;
    setLoading(true);
    setError(null);
    setConfigHint(null);
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
        let hint = body.configHint ?? body.oauthHint ?? null;
        if (
          !hint &&
          typeof window !== "undefined" &&
          body.error?.includes("not configured")
        ) {
          const host = window.location.hostname;
          if (host !== "localhost" && host !== "127.0.0.1") {
            hint = `This server (${host}) is missing EBAY_CLIENT_ID and EBAY_CLIENT_SECRET. Add them in Vercel → Project → Environment Variables (Production), then redeploy.`;
          } else {
            hint =
              "Add EBAY_CLIENT_ID and EBAY_CLIENT_SECRET to Alpha1/.env.local, then restart dev (npm run dev:clean). Use http://localhost:3002 if DEV_PORT=3002.";
          }
        }
        setConfigHint(hint);
        throw new Error(body.error ?? `Unable to load eBay auctions (${res.status})`);
      }
      setPayload(body);
      setConfigHint(null);
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
        setConfigHint(null);
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
      configHint,
      reload: () => load(true),
    }),
    [payload, listings, loading, error, configHint, load],
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
