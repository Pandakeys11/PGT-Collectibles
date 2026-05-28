/** Matches eBay search: Pokémon TCG · ending soonest · US preferred. */
export const EBAY_ENDING_SOON_HUB_URL =
  "https://www.ebay.com/sch/i.html?_nkw=Pokemon&_sacat=2536&_from=R40&_sop=1&rt=nc&LH_PrefLoc=2";

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
  ready: boolean;
  error?: string;
  fetchedAt: string | null;
  hubUrl: string;
  listings: EbayEndingSoonListing[];
  oauthHint?: string;
};
