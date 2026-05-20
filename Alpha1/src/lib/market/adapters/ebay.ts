import type { MarketApiAdapter, ApiAdapterResult } from "@/lib/market/adapters/types";
import {
  getEbayApiEnv,
  getEbayClientId,
  getEbayClientSecret,
  type EbayApiEnv,
} from "@/lib/market/env-market";
import { buildEbayPokemonCardKeywordQuery } from "@/lib/market/ebay-sold-common";
import type { ExtractedCard, MarketEvidence } from "@/lib/scan/schemas";

/** Same scope string for Sandbox and Production OAuth. */
const EBAY_CLIENT_CREDENTIALS_SCOPE = "https://api.ebay.com/oauth/api_scope";

function ebayHosts(env: EbayApiEnv): { tokenUrl: string; searchUrl: string } {
  if (env === "sandbox") {
    return {
      tokenUrl: "https://api.sandbox.ebay.com/identity/v1/oauth2/token",
      searchUrl: "https://api.sandbox.ebay.com/buy/browse/v1/item_summary/search",
    };
  }
  return {
    tokenUrl: "https://api.ebay.com/identity/v1/oauth2/token",
    searchUrl: "https://api.ebay.com/buy/browse/v1/item_summary/search",
  };
}

/** One token cache per API host (Sandbox vs Production). */
const tokenCache = new Map<EbayApiEnv, { accessToken: string; expiresAt: number }>();

function compactQuery(card: ExtractedCard): string {
  const q = buildEbayPokemonCardKeywordQuery(card);
  return q.length > 120 ? q.slice(0, 120).trim() : q;
}

async function fetchAccessToken(env: EbayApiEnv): Promise<{ token: string | null; oauthHint: string | null }> {
  const clientId = getEbayClientId();
  const clientSecret = getEbayClientSecret();
  if (!clientId || !clientSecret) return { token: null, oauthHint: null };

  const cached = tokenCache.get(env);
  if (cached && Date.now() < cached.expiresAt - 60_000) {
    return { token: cached.accessToken, oauthHint: null };
  }

  const { tokenUrl } = ebayHosts(env);
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    scope: EBAY_CLIENT_CREDENTIALS_SCOPE,
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: body.toString(),
    signal: AbortSignal.timeout(10_000),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !payload.access_token) {
    const hint =
      payload.error || payload.error_description
        ? `eBay OAuth: ${payload.error ?? "error"}${payload.error_description ? ` — ${payload.error_description}` : ""}`
        : `eBay OAuth HTTP ${response.status}`;
    return { token: null, oauthHint: hint };
  }

  const expiresIn = typeof payload.expires_in === "number" ? payload.expires_in : 3600;
  tokenCache.set(env, {
    accessToken: payload.access_token,
    expiresAt: Date.now() + expiresIn * 1000,
  });
  return { token: payload.access_token, oauthHint: null };
}

function inferSlabFromTitle(title: string): string | null {
  const hay = title.toLowerCase();
  if (/black\s*label|bgs.*black/.test(hay)) return "BGS Black Label";
  if (/psa\s*10|gem\s*mint\s*10/.test(hay)) return "PSA 10";
  if (/cgc/.test(hay) && /cgc\s*10(\.0)?\b/.test(hay)) return "CGC 10";
  if (/psa\s*9\b|cgc\s*9\b|bgs\s*9\b/.test(hay)) return "PSA 9";
  if (/raw\b|ungraded\b/.test(hay)) return "raw";
  return null;
}

function itemToEvidence(
  item: {
    itemId?: string;
    title?: string;
    itemWebUrl?: string;
    price?: { value?: string; currency?: string };
  },
  kind: MarketEvidence["kind"],
  slabHint: string | null,
): MarketEvidence | null {
  const title = String(item.title ?? "").trim();
  const url = typeof item.itemWebUrl === "string" && item.itemWebUrl.startsWith("http") ? item.itemWebUrl : null;
  if (!title || !url) return null;
  const raw = item.price?.value;
  let priceUsd: number | null = null;
  if (typeof raw === "string" && raw.trim()) {
    const n = Number.parseFloat(raw.replace(/,/g, ""));
    if (Number.isFinite(n)) priceUsd = n;
  } else if (typeof raw === "number" && Number.isFinite(raw)) {
    priceUsd = raw;
  }
  return {
    kind,
    title,
    priceUsd,
    observedAt: null,
    url,
    source: "eBay",
    slab: slabHint ?? inferSlabFromTitle(title),
  };
}

export const ebayBrowseAdapter: MarketApiAdapter = {
  id: "ebay_browse",
  async collect(card: ExtractedCard): Promise<ApiAdapterResult> {
    const warnings: string[] = [];
    const env = getEbayApiEnv();
    const { searchUrl } = ebayHosts(env);

    if (!getEbayClientId() || !getEbayClientSecret()) {
      if (env === "sandbox") {
        warnings.push("eBay Browse: add Sandbox OAuth credentials (EBAY_SANDBOX_* or EBAY_* with EBAY_API_ENV=sandbox).");
      }
      return { adapter: "ebay_browse", evidence: [], warnings: warnings.length ? warnings : undefined };
    }

    const { token, oauthHint } = await fetchAccessToken(env);
    if (!token) {
      const base =
        env === "sandbox"
          ? "eBay Browse OAuth failed (Sandbox keys must match api.sandbox.ebay.com)."
          : "eBay Browse OAuth failed — check EBAY_CLIENT_ID / EBAY_CLIENT_SECRET.";
      warnings.push(oauthHint ? `${base} ${oauthHint}` : base);
      return { adapter: "ebay_browse", evidence: [], warnings };
    }

    const q = compactQuery(card) || card.name;
    const slabHint =
      card.grader && card.grade
        ? `${card.grader} ${card.grade}`.includes("Black Label")
          ? "BGS Black Label"
          : card.grader === "CGC" && /\b10|Pristine/i.test(card.grade)
            ? "CGC 10"
            : card.grader === "PSA" && card.grade === "10"
              ? "PSA 10"
              : card.grader === "PSA" && card.grade === "9"
                ? "PSA 9"
                : null
        : null;
    const params = new URLSearchParams({
      q,
      limit: "12",
    });
    params.append("filter", "marketplaceIds:{EBAY_US}");

    const response = await fetch(`${searchUrl}?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(12_000),
    });

    if (!response.ok) {
      const errBody = (await response.json().catch(() => ({}))) as { errors?: Array<{ message?: string }> };
      const msg = errBody.errors?.[0]?.message;
      warnings.push(
        msg
          ? `eBay Browse (${env}) HTTP ${response.status}: ${msg}`
          : `eBay Browse (${env}) HTTP ${response.status}`,
      );
      return { adapter: "ebay_browse", evidence: [], warnings };
    }

    const payload = (await response.json()) as {
      itemSummaries?: Array<{
        itemId?: string;
        title?: string;
        itemWebUrl?: string;
        price?: { value?: string; currency?: string };
      }>;
    };

    const summaries = payload.itemSummaries ?? [];
    const evidence: MarketEvidence[] = [];
    for (const row of summaries) {
      const rowEvidence = itemToEvidence(row, "active", slabHint);
      if (rowEvidence) evidence.push(rowEvidence);
    }

    return { adapter: "ebay_browse", evidence, warnings: warnings.length ? warnings : undefined };
  },
};
