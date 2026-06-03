import {
  getPokeTraceApiKey,
  getPokeTraceBaseUrl,
  isPokeTraceConfigured,
} from "@/lib/market/env-market";
import { isPokeTraceRateLimited, markPokeTraceRateLimited } from "@/lib/market/poketrace/rate-limit";

export function pokeTraceHeaders(): HeadersInit {
  const key = getPokeTraceApiKey();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (key) headers["X-API-Key"] = key;
  return headers;
}

export async function pokeTraceGet<T>(
  path: string,
  params?: Record<string, string | number | undefined>,
): Promise<T | null> {
  if (!isPokeTraceConfigured() || isPokeTraceRateLimited()) return null;
  const base = getPokeTraceBaseUrl();
  const url = new URL(path.startsWith("http") ? path : `${base}${path.startsWith("/") ? "" : "/"}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && String(value).length) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  const response = await fetch(url.toString(), {
    headers: pokeTraceHeaders(),
    cache: "no-store",
    signal: AbortSignal.timeout(14_000),
  });
  if (response.status === 429) {
    try {
      const body = (await response.json()) as {
        error?: string;
        usage?: { daily?: { resetsAt?: string } };
      };
      markPokeTraceRateLimited(body.usage?.daily?.resetsAt ?? null);
    } catch {
      markPokeTraceRateLimited(null);
    }
    return null;
  }
  if (!response.ok) return null;
  return (await response.json()) as T;
}

export { isPokeTraceRateLimited, pokeTraceRateLimitMessage } from "@/lib/market/poketrace/rate-limit";
