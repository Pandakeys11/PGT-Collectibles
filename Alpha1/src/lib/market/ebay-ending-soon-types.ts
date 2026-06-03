import type { EbayEndingSoonFeedId } from "@/lib/market/ebay-ending-soon-feeds";

export type { EbayEndingSoonFeedId } from "@/lib/market/ebay-ending-soon-feeds";
export {
  EBAY_ENDING_SOON_HUB_URL,
  EBAY_ENDING_SOON_FEEDS,
  DEFAULT_EBAY_ENDING_SOON_FEED_ID,
} from "@/lib/market/ebay-ending-soon-feeds";

export type EbayEndingSoonListing = {
  id: string;
  title: string;
  priceUsd: number | null;
  imageUrl: string | null;
  url: string;
  /** ISO-8601 auction end time from eBay Browse API. */
  endsAt: string;
  bidCount: number | null;
};

export type EbayEndingSoonPayload = {
  feedId: EbayEndingSoonFeedId;
  feedLabel: string;
  ready: boolean;
  error?: string;
  /** Actionable fix when `ready` is false (local .env vs Vercel, etc.). */
  configHint?: string;
  configured?: boolean;
  fetchedAt: string | null;
  hubUrl: string;
  listings: EbayEndingSoonListing[];
  oauthHint?: string;
};
