import { getJustTcgApiKey, getJustTcgBaseUrl, isJustTcgConfigured } from "@/lib/market/env-market";
import type {
  JustTcgBatchLookupItem,
  JustTcgCard,
  JustTcgListResponse,
} from "@/lib/market/justtcg/types";

const DEFAULT_TIMEOUT_MS = 14_000;

export type JustTcgClientResult = {
  cards: JustTcgCard[];
  usage: JustTcgListResponse["usage"];
  error: string | null;
};

function headers(apiKey: string): HeadersInit {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "x-api-key": apiKey,
  };
}

async function parseResponse(res: Response): Promise<JustTcgListResponse> {
  const text = await res.text();
  try {
    return JSON.parse(text) as JustTcgListResponse;
  } catch {
    return { error: text.slice(0, 200) || res.statusText };
  }
}

export async function justTcgGetCards(
  params: Record<string, string | number | undefined>,
): Promise<JustTcgClientResult> {
  const apiKey = getJustTcgApiKey();
  if (!apiKey) return { cards: [], usage: undefined, error: "missing_api_key" };

  const url = new URL(`${getJustTcgBaseUrl()}/cards`);
  url.searchParams.set("include_statistics", "7d,30d");
  url.searchParams.set("include_price_history", "false");
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value).length) {
      url.searchParams.set(key, String(value));
    }
  }

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json", "x-api-key": apiKey },
    cache: "no-store",
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });
  const body = await parseResponse(res);
  if (!res.ok) {
    return {
      cards: body.data ?? [],
      usage: body.usage,
      error: body.error ?? body.code ?? `http_${res.status}`,
    };
  }
  return { cards: body.data ?? [], usage: body.usage, error: null };
}

const STATS_QUERY = "include_statistics=7d%2C30d&include_price_history=false";

/** Batch price lookup (Free max 20 items per call). */
export async function justTcgBatchLookupCards(
  items: JustTcgBatchLookupItem[],
): Promise<JustTcgClientResult> {
  const apiKey = getJustTcgApiKey();
  if (!apiKey || items.length === 0) {
    return { cards: [], usage: undefined, error: items.length ? "missing_api_key" : null };
  }

  const res = await fetch(`${getJustTcgBaseUrl()}/cards?${STATS_QUERY}`, {
    method: "POST",
    headers: headers(apiKey),
    body: JSON.stringify(items),
    cache: "no-store",
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });
  const body = await parseResponse(res);
  if (!res.ok) {
    return {
      cards: body.data ?? [],
      usage: body.usage,
      error: body.error ?? body.code ?? `http_${res.status}`,
    };
  }
  return { cards: body.data ?? [], usage: body.usage, error: null };
}

export function isJustTcgReady(): boolean {
  return isJustTcgConfigured();
}
