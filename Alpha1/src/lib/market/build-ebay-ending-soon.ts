import {
  ebayBrowseHosts,
  fetchEbayBrowseAccessToken,
} from "@/lib/market/adapters/ebay";
import {
  ebayEndingSoonHubUrl,
  resolveEbayEndingSoonFeed,
  type EbayEndingSoonFeedId,
} from "@/lib/market/ebay-ending-soon-feeds";
import type { EbayEndingSoonListing, EbayEndingSoonPayload } from "@/lib/market/ebay-ending-soon-types";
import { getEbayApiEnv, getEbayBrowseConfigStatus } from "@/lib/market/env-market";

const LISTING_LIMIT = 24;

type BrowseItemSummary = {
  itemId?: string;
  title?: string;
  itemWebUrl?: string;
  itemEndDate?: string;
  bidCount?: number;
  price?: { value?: string; currency?: string };
  currentBidPrice?: { value?: string; currency?: string };
  image?: { imageUrl?: string };
};

function parseUsd(
  price: { value?: string; currency?: string } | undefined,
): number | null {
  if (!price?.value) return null;
  const n = Number.parseFloat(String(price.value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function mapBrowseItem(item: BrowseItemSummary): EbayEndingSoonListing | null {
  const title = String(item.title ?? "").trim();
  const url =
    typeof item.itemWebUrl === "string" && item.itemWebUrl.startsWith("http")
      ? item.itemWebUrl
      : null;
  const endsAt = typeof item.itemEndDate === "string" ? item.itemEndDate.trim() : "";
  const id = String(item.itemId ?? "").trim();
  if (!title || !url || !endsAt || !id) return null;

  const endMs = Date.parse(endsAt);
  if (!Number.isFinite(endMs) || endMs <= Date.now()) return null;

  const priceUsd = parseUsd(item.currentBidPrice) ?? parseUsd(item.price);
  const imageUrl =
    typeof item.image?.imageUrl === "string" && item.image.imageUrl.startsWith("http")
      ? item.image.imageUrl
      : null;
  const bidCount =
    typeof item.bidCount === "number" && Number.isFinite(item.bidCount) ? item.bidCount : null;

  return {
    id,
    title,
    priceUsd,
    imageUrl,
    url,
    endsAt: new Date(endMs).toISOString(),
    bidCount,
  };
}

function emptyPayload(
  feed: ReturnType<typeof resolveEbayEndingSoonFeed>,
): EbayEndingSoonPayload {
  return {
    feedId: feed.id,
    feedLabel: feed.label,
    ready: false,
    fetchedAt: null,
    hubUrl: ebayEndingSoonHubUrl(feed),
    listings: [],
  };
}

export async function buildEbayEndingSoonFeed(
  feedId?: string | null,
): Promise<EbayEndingSoonPayload> {
  const feed = resolveEbayEndingSoonFeed(feedId);
  const empty = emptyPayload(feed);

  const config = getEbayBrowseConfigStatus();
  if (!config.configured) {
    return {
      ...empty,
      configured: false,
      error: config.message,
      configHint: config.hint,
    };
  }

  const env = getEbayApiEnv();
  const { searchUrl } = ebayBrowseHosts(env);
  const { token, oauthHint } = await fetchEbayBrowseAccessToken(env);
  if (!token) {
    return {
      ...empty,
      error: oauthHint ?? "eBay Browse OAuth failed.",
      oauthHint: oauthHint ?? undefined,
    };
  }

  const params = new URLSearchParams({
    q: feed.query,
    category_ids: feed.categoryId,
    limit: String(LISTING_LIMIT),
    sort: "endingSoonest",
  });
  params.append("filter", "buyingOptions:{AUCTION}");
  params.append("filter", "itemLocationCountry:US");

  const response = await fetch(`${searchUrl}?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(14_000),
  });

  if (!response.ok) {
    const errBody = (await response.json().catch(() => ({}))) as {
      errors?: Array<{ message?: string }>;
    };
    const msg = errBody.errors?.[0]?.message;
    return {
      ...empty,
      error: msg
        ? `eBay Browse (${env}) HTTP ${response.status}: ${msg}`
        : `eBay Browse (${env}) HTTP ${response.status}`,
    };
  }

  const payload = (await response.json()) as { itemSummaries?: BrowseItemSummary[] };
  const listings = (payload.itemSummaries ?? [])
    .map(mapBrowseItem)
    .filter((row): row is EbayEndingSoonListing => Boolean(row))
    .sort((a, b) => Date.parse(a.endsAt) - Date.parse(b.endsAt));

  if (listings.length === 0) {
    return {
      ...empty,
      fetchedAt: new Date().toISOString(),
      error: feed.emptyMessage,
    };
  }

  return {
    feedId: feed.id,
    feedLabel: feed.label,
    ready: true,
    configured: true,
    fetchedAt: new Date().toISOString(),
    hubUrl: ebayEndingSoonHubUrl(feed),
    listings,
  };
}

export type { EbayEndingSoonFeedId };
