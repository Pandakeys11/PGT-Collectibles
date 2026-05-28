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
  maxLaneLength,
  pickBannerTriplet,
  type LiveMarketBannerPill,
} from "@/lib/market/live-market-ticker-display";
import type {
  LiveMarketTickerLane,
  LiveMarketTickerLaneId,
  LiveMarketTickerPayload,
  LiveMarketTickerSlide,
} from "@/lib/market/live-market-ticker-types";
import { LIVE_MARKET_TICKER_LANE_ORDER } from "@/lib/market/live-market-ticker-types";

const STORAGE_KEY = "pgt.live-market-ticker.v4";
const FETCH_TIMEOUT_MS = 95_000;
const LANE_CYCLE_MS = 5_500;

type LiveMarketTickerContextValue = {
  payload: LiveMarketTickerPayload | null;
  lanes: LiveMarketTickerLane[];
  slides: LiveMarketTickerSlide[];
  bannerPills: LiveMarketBannerPill[];
  laneSlides: (laneId: LiveMarketTickerLaneId) => LiveMarketTickerSlide[];
  slideAt: (laneId: LiveMarketTickerLaneId) => LiveMarketTickerSlide | null;
  laneIndex: (laneId: LiveMarketTickerLaneId) => number;
  tick: number;
  loading: boolean;
  error: string | null;
  paused: boolean;
  setPaused: (value: boolean | ((prev: boolean) => boolean)) => void;
  reload: () => Promise<void>;
  goToLaneIndex: (laneId: LiveMarketTickerLaneId, index: number) => void;
  advanceLane: (laneId: LiveMarketTickerLaneId, delta?: number) => void;
};

const LiveMarketTickerContext = createContext<LiveMarketTickerContextValue | null>(null);

function readStoredPayload(): LiveMarketTickerPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LiveMarketTickerPayload;
    return parsed?.ready && parsed.lanes?.length ? parsed : null;
  } catch {
    return null;
  }
}

function storePayload(body: LiveMarketTickerPayload) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(body));
  } catch {
    /* quota */
  }
}

export function LiveMarketTickerProvider({ children }: { children: ReactNode }) {
  const [payload, setPayload] = useState<LiveMarketTickerPayload | null>(() => readStoredPayload());
  const [tick, setTick] = useState(0);
  const [laneFocus, setLaneFocus] = useState<Partial<Record<LiveMarketTickerLaneId, number>>>({});
  const [loading, setLoading] = useState(!readStoredPayload());
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const loadGen = useRef(0);

  const lanes = payload?.lanes ?? [];
  const slides = payload?.slides ?? [];
  const tourLength = maxLaneLength(lanes);

  const laneById = useMemo(() => {
    const map = new Map<LiveMarketTickerLaneId, LiveMarketTickerLane>();
    for (const lane of lanes) map.set(lane.id, lane);
    return map;
  }, [lanes]);

  const laneByIdRef = useRef(laneById);
  laneByIdRef.current = laneById;

  const bannerPills = useMemo(() => pickBannerTriplet(tick, lanes), [tick, lanes]);

  const load = useCallback(async (refresh = false) => {
    const gen = ++loadGen.current;
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const q = refresh ? "?refresh=1" : "";
      const res = await fetch(`/api/market/live-ticker${q}`, {
        credentials: "same-origin",
        signal: controller.signal,
      });
      const body = (await res.json()) as LiveMarketTickerPayload;
      if (gen !== loadGen.current) return;
      if (!res.ok || !body.ready) {
        throw new Error(body.error ?? `Unable to load live market (${res.status})`);
      }
      setPayload(body);
      storePayload(body);
      setTick(0);
      setLaneFocus({});
    } catch (e) {
      if (gen !== loadGen.current) return;
      const message =
        e instanceof Error
          ? e.name === "AbortError"
            ? "Market tour timed out — try Retry"
            : e.message
          : "Load failed";
      const cached = readStoredPayload();
      if (cached) {
        setPayload(cached);
        setTick(0);
        setLaneFocus({});
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
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    if (!tourLength || paused) return;
    const id = window.setInterval(() => {
      if (pausedRef.current) return;
      setTick((t) => (t + 1) % tourLength);
    }, LANE_CYCLE_MS);
    return () => window.clearInterval(id);
  }, [tourLength, paused]);

  const laneSlides = useCallback(
    (laneId: LiveMarketTickerLaneId) => laneById.get(laneId)?.slides ?? [],
    [laneById],
  );

  const slideAt = useCallback(
    (laneId: LiveMarketTickerLaneId): LiveMarketTickerSlide | null => {
      const lane = laneById.get(laneId);
      if (!lane?.slides.length) return null;
      if (laneFocus[laneId] != null) {
        const idx = laneFocus[laneId]!;
        return lane.slides[((idx % lane.slides.length) + lane.slides.length) % lane.slides.length] ?? null;
      }
      const pill = bannerPills.find((p) => p.laneId === laneId);
      if (pill) return pill.slide;
      const len = lane.slides.length;
      const shift = Math.floor(
        len *
          (laneId === "momentum"
            ? 1 / 3
            : laneId === "spotlight" || laneId === "jpn_art"
              ? 2 / 3
              : 0),
      );
      return lane.slides[(tick + shift) % len] ?? null;
    },
    [laneById, laneFocus, bannerPills, tick],
  );

  const laneIndex = useCallback(
    (laneId: LiveMarketTickerLaneId) => {
      if (laneFocus[laneId] != null) return laneFocus[laneId]!;
      const pill = bannerPills.find((p) => p.laneId === laneId);
      if (pill) return pill.index;
      const lane = laneById.get(laneId);
      if (!lane?.slides.length) return 0;
      const shift = Math.floor(
        lane.slides.length *
          (laneId === "momentum"
            ? 1 / 3
            : laneId === "spotlight" || laneId === "jpn_art"
              ? 2 / 3
              : 0),
      );
      return (tick + shift) % lane.slides.length;
    },
    [laneFocus, bannerPills, laneById, tick],
  );

  const goToLaneIndex = useCallback((laneId: LiveMarketTickerLaneId, index: number) => {
    const lane = laneByIdRef.current.get(laneId);
    if (!lane?.slides.length) return;
    const len = lane.slides.length;
    setLaneFocus((prev) => ({
      ...prev,
      [laneId]: ((index % len) + len) % len,
    }));
  }, []);

  const advanceLane = useCallback((laneId: LiveMarketTickerLaneId, delta = 1) => {
    const lane = laneByIdRef.current.get(laneId);
    if (!lane?.slides.length) return;
    const len = lane.slides.length;
    setLaneFocus((prev) => {
      const current =
        prev[laneId] ??
        bannerPills.find((p) => p.laneId === laneId)?.index ??
        (tick +
          Math.floor(
            len *
              (laneId === "momentum"
                ? 1 / 3
                : laneId === "spotlight" || laneId === "jpn_art"
                  ? 2 / 3
                  : 0),
          )) %
          len;
      return { ...prev, [laneId]: (current + delta + len) % len };
    });
  }, [bannerPills, tick]);

  const value = useMemo<LiveMarketTickerContextValue>(
    () => ({
      payload,
      lanes,
      slides,
      bannerPills,
      laneSlides,
      slideAt,
      laneIndex,
      tick,
      loading,
      error,
      paused,
      setPaused,
      reload: () => load(true),
      goToLaneIndex,
      advanceLane,
    }),
    [
      payload,
      lanes,
      slides,
      bannerPills,
      laneSlides,
      slideAt,
      laneIndex,
      tick,
      loading,
      error,
      paused,
      load,
      goToLaneIndex,
      advanceLane,
    ],
  );

  return (
    <LiveMarketTickerContext.Provider value={value}>{children}</LiveMarketTickerContext.Provider>
  );
}

export function useLiveMarketTicker() {
  const ctx = useContext(LiveMarketTickerContext);
  if (!ctx) {
    throw new Error("useLiveMarketTicker must be used within LiveMarketTickerProvider");
  }
  return ctx;
}
