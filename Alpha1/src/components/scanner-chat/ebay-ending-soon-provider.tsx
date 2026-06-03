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
import {
  DEFAULT_EBAY_ENDING_SOON_FEED_ID,
  EBAY_ENDING_SOON_FEEDS,
  type EbayEndingSoonFeedDef,
  type EbayEndingSoonFeedId,
} from "@/lib/market/ebay-ending-soon-feeds";
import type { EbayEndingSoonPayload } from "@/lib/market/ebay-ending-soon-types";

const STORAGE_PREFIX = "pgt.ebay-ending-soon.v2";
const LAST_FEED_KEY = "pgt.ebay-ending-soon.active-feed";
const FETCH_TIMEOUT_MS = 28_000;
const AUTO_REFRESH_MS = 4 * 60 * 1000;

type EbayEndingSoonContextValue = {
  feeds: EbayEndingSoonFeedDef[];
  activeFeedId: EbayEndingSoonFeedId;
  activeFeed: EbayEndingSoonFeedDef;
  setActiveFeedId: (id: EbayEndingSoonFeedId) => void;
  payload: EbayEndingSoonPayload | null;
  listings: EbayEndingSoonPayload["listings"];
  loading: boolean;
  error: string | null;
  configHint: string | null;
  reload: () => Promise<void>;
};

const EbayEndingSoonContext = createContext<EbayEndingSoonContextValue | null>(null);

function storageKey(feedId: string): string {
  return `${STORAGE_PREFIX}:${feedId}`;
}

function readStoredPayload(feedId: string): EbayEndingSoonPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(storageKey(feedId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EbayEndingSoonPayload;
    return parsed?.ready && parsed.listings?.length ? parsed : null;
  } catch {
    return null;
  }
}

function storePayload(feedId: string, body: EbayEndingSoonPayload) {
  try {
    sessionStorage.setItem(storageKey(feedId), JSON.stringify(body));
  } catch {
    /* quota */
  }
}

function readLastFeedId(): EbayEndingSoonFeedId {
  if (typeof window === "undefined") return DEFAULT_EBAY_ENDING_SOON_FEED_ID;
  const raw = sessionStorage.getItem(LAST_FEED_KEY)?.trim();
  if (EBAY_ENDING_SOON_FEEDS.some((f) => f.id === raw)) return raw as EbayEndingSoonFeedId;
  return DEFAULT_EBAY_ENDING_SOON_FEED_ID;
}

export function EbayEndingSoonProvider({ children }: { children: ReactNode }) {
  const [activeFeedId, setActiveFeedIdState] = useState<EbayEndingSoonFeedId>(DEFAULT_EBAY_ENDING_SOON_FEED_ID);
  const [payload, setPayload] = useState<EbayEndingSoonPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configHint, setConfigHint] = useState<string | null>(null);
  const loadGen = useRef(0);
  const activeFeedIdRef = useRef(activeFeedId);

  activeFeedIdRef.current = activeFeedId;

  const activeFeed = useMemo(
    () => EBAY_ENDING_SOON_FEEDS.find((f) => f.id === activeFeedId) ?? EBAY_ENDING_SOON_FEEDS[0]!,
    [activeFeedId],
  );

  const load = useCallback(async (feedId: EbayEndingSoonFeedId, refresh = false) => {
    const gen = ++loadGen.current;
    setLoading(true);
    setError(null);
    setConfigHint(null);

    const cached = !refresh ? readStoredPayload(feedId) : null;
    if (cached) {
      setPayload(cached);
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const params = new URLSearchParams({ feed: feedId });
      if (refresh) params.set("refresh", "1");
      const res = await fetch(`/api/market/ebay-ending-soon?${params}`, {
        credentials: "same-origin",
        signal: controller.signal,
      });
      const body = (await res.json()) as EbayEndingSoonPayload;
      if (gen !== loadGen.current || activeFeedIdRef.current !== feedId) return;

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
      storePayload(feedId, body);
    } catch (e) {
      if (gen !== loadGen.current || activeFeedIdRef.current !== feedId) return;
      const message =
        e instanceof Error
          ? e.name === "AbortError"
            ? "eBay auctions timed out — try Retry"
            : e.message
          : "Load failed";
      const fallback = readStoredPayload(feedId);
      if (fallback) {
        setPayload(fallback);
        setError(null);
        setConfigHint(null);
      } else {
        setPayload(null);
        setError(message);
      }
    } finally {
      window.clearTimeout(timer);
      if (gen === loadGen.current && activeFeedIdRef.current === feedId) {
        setLoading(false);
      }
    }
  }, []);

  const setActiveFeedId = useCallback(
    (id: EbayEndingSoonFeedId) => {
      if (id === activeFeedIdRef.current) return;
      activeFeedIdRef.current = id;
      setActiveFeedIdState(id);
      try {
        sessionStorage.setItem(LAST_FEED_KEY, id);
      } catch {
        /* ignore */
      }
      const cached = readStoredPayload(id);
      setPayload(cached);
      setError(null);
      setConfigHint(null);
      void load(id, false);
    },
    [load],
  );

  useEffect(() => {
    const last = readLastFeedId();
    activeFeedIdRef.current = last;
    setActiveFeedIdState(last);
    const cached = readStoredPayload(last);
    setPayload(cached);
    setLoading(!cached);
    void load(last, false);
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void load(activeFeedIdRef.current, true);
    }, AUTO_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [load]);

  const listings = useMemo(() => payload?.listings ?? [], [payload]);

  const value = useMemo<EbayEndingSoonContextValue>(
    () => ({
      feeds: EBAY_ENDING_SOON_FEEDS,
      activeFeedId,
      activeFeed,
      setActiveFeedId,
      payload,
      listings,
      loading,
      error,
      configHint,
      reload: () => load(activeFeedId, true),
    }),
    [
      activeFeedId,
      activeFeed,
      setActiveFeedId,
      payload,
      listings,
      loading,
      error,
      configHint,
      load,
    ],
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
