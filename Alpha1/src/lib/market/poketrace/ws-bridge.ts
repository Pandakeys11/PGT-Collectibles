import WebSocket from "ws";
import { getPokeTraceApiKey, getPokeTraceWsUrl, isPokeTraceWsEnabled } from "@/lib/market/env-market";
import { applyPokeTraceRealtimeUpdate } from "@/lib/market/poketrace/realtime-store";
import {
  isPokeTraceAnomaly,
  pokeTraceTrendPct,
} from "@/lib/market/poketrace/tiers";
import type { PokeTraceWsEvent } from "@/lib/market/poketrace/types";

export type PokeTraceWsStatus = {
  enabled: boolean;
  connected: boolean;
  connecting: boolean;
  /** Server closed with Scale-plan required (4003) — stop reconnecting. */
  planRequired: boolean;
  lastError: string | null;
  lastConnectedAt: string | null;
  lastMessageAt: string | null;
  messagesReceived: number;
  updatesApplied: number;
};

const status: PokeTraceWsStatus = {
  enabled: false,
  connected: false,
  connecting: false,
  planRequired: false,
  lastError: null,
  lastConnectedAt: null,
  lastMessageAt: null,
  messagesReceived: 0,
  updatesApplied: 0,
};

let socket: WebSocket | null = null;
let connectPromise: Promise<void> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let intentionalClose = false;

function refreshEnabled(): void {
  status.enabled = isPokeTraceWsEnabled();
}

function clearTimers(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
}

function scheduleReconnect(): void {
  if (intentionalClose || status.planRequired || reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectPromise = null;
    void ensurePokeTraceWsBridge();
  }, 15_000);
}

function handleMessage(raw: string): void {
  status.messagesReceived += 1;
  status.lastMessageAt = new Date().toISOString();

  let parsed: PokeTraceWsEvent;
  try {
    parsed = JSON.parse(raw) as PokeTraceWsEvent;
  } catch {
    return;
  }

  if ("type" in parsed && parsed.type === "ping") {
    socket?.send(JSON.stringify({ type: "pong" }));
    return;
  }

  if ("event" in parsed && parsed.event === "connected") {
    status.lastError = null;
    return;
  }

  if (!("event" in parsed) || parsed.event !== "price.card-updated" || !parsed.data) return;

  const data = parsed.data;
  const priceUsd = data.price;
  if (typeof priceUsd !== "number" || !Number.isFinite(priceUsd)) return;

  const synthetic = {
    avg: priceUsd,
    avg7d: data.avg7d,
    avg30d: data.avg30d,
    median3d: data.avg7d ?? priceUsd,
    median7d: data.avg7d,
    median30d: data.avg30d,
  };

  applyPokeTraceRealtimeUpdate({
    cardId: data.id,
    source: data.source,
    tier: data.tier ?? null,
    priceUsd: Math.round(priceUsd * 100) / 100,
    currency: data.currency ?? "USD",
    trendPct: pokeTraceTrendPct(synthetic),
    anomalyFlag: isPokeTraceAnomaly(synthetic),
    observedAt: parsed.timestamp ?? new Date().toISOString(),
  });
  status.updatesApplied += 1;
}

async function openSocket(): Promise<void> {
  refreshEnabled();
  const key = getPokeTraceApiKey();
  if (!key || !status.enabled) return;

  intentionalClose = false;
  status.connecting = true;
  status.lastError = null;

  const url = getPokeTraceWsUrl();
  const ws = new WebSocket(url, {
    headers: { "X-API-Key": key },
  });

  socket = ws;

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("PokeTrace WS connect timeout (12s)"));
    }, 12_000);

    ws.once("open", () => {
      clearTimeout(timeout);
      status.connected = true;
      status.connecting = false;
      status.lastConnectedAt = new Date().toISOString();
      status.lastError = null;

      pingTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        }
      }, 45_000);

      resolve();
    });

    ws.once("error", (err) => {
      clearTimeout(timeout);
      status.connecting = false;
      status.connected = false;
      status.lastError = err instanceof Error ? err.message : "PokeTrace WS error";
      reject(err instanceof Error ? err : new Error("PokeTrace WS error"));
    });

    ws.on("message", (data) => {
      const text = typeof data === "string" ? data : data.toString("utf8");
      if (text) handleMessage(text);
    });

    ws.once("close", (code, reasonBuf) => {
      clearTimers();
      status.connected = false;
      status.connecting = false;
      socket = null;
      connectPromise = null;
      const reason = reasonBuf?.toString("utf8") ?? "";
      if (code === 4003 || /scale plan/i.test(reason)) {
        status.planRequired = true;
        status.lastError =
          reason.trim() || "PokeTrace WebSocket requires Scale plan (close 4003)";
        return;
      }
      if (!intentionalClose) scheduleReconnect();
    });
  });
}

/** Starts the PokeTrace WS feed (no-op when disabled). Uses `ws` for X-API-Key header auth. */
export function ensurePokeTraceWsBridge(): void {
  refreshEnabled();
  if (!status.enabled || status.planRequired) return;
  if (socket?.readyState === WebSocket.OPEN) return;
  if (connectPromise) return;

  connectPromise = openSocket().catch((err) => {
    status.lastError = err instanceof Error ? err.message : "PokeTrace WS connect failed";
    scheduleReconnect();
  }).finally(() => {
    connectPromise = null;
    status.connecting = false;
  });
}

export function getPokeTraceWsStatus(): PokeTraceWsStatus {
  refreshEnabled();
  return { ...status };
}

export function stopPokeTraceWsBridge(): void {
  intentionalClose = true;
  clearTimers();
  if (socket) {
    socket.close();
    socket = null;
  }
  connectPromise = null;
  status.connected = false;
  status.connecting = false;
}
