/** eBay category: CCG individual cards (Pokémon, One Piece singles, graded). */
export const EBAY_CCG_INDIVIDUAL_CATEGORY = "2536";

/** eBay category: CCG sealed boxes & packs. */
export const EBAY_CCG_SEALED_CATEGORY = "183454";

export type EbayEndingSoonFeedId =
  | "pokemon-psa10"
  | "pokemon-sealed"
  | "onepiece-tcg"
  | "onepiece-psa10";

export type EbayEndingSoonFeedDef = {
  id: EbayEndingSoonFeedId;
  label: string;
  shortLabel: string;
  query: string;
  categoryId: string;
  emptyMessage: string;
};

const AUCTION_SUFFIX = "&_from=R40&_sop=1&rt=nc&LH_Auction=1&LH_PrefLoc=2";

function buildHubUrl(query: string, categoryId: string): string {
  const q = encodeURIComponent(query.trim());
  return `https://www.ebay.com/sch/i.html?_nkw=${q}&_sacat=${categoryId}${AUCTION_SUFFIX}`;
}

export const EBAY_ENDING_SOON_FEEDS: EbayEndingSoonFeedDef[] = [
  {
    id: "pokemon-psa10",
    label: "PSA 10 Pokémon",
    shortLabel: "PSA 10",
    query: "Pokemon PSA 10",
    categoryId: EBAY_CCG_INDIVIDUAL_CATEGORY,
    emptyMessage: "No PSA 10 Pokémon auctions ending soon — try again shortly.",
  },
  {
    id: "pokemon-sealed",
    label: "Pokémon TCG sealed",
    shortLabel: "Sealed",
    query: "Pokemon TCG sealed",
    categoryId: EBAY_CCG_SEALED_CATEGORY,
    emptyMessage: "No sealed Pokémon TCG auctions ending soon — try again shortly.",
  },
  {
    id: "onepiece-tcg",
    label: "One Piece TCG",
    shortLabel: "OP TCG",
    query: "One Piece TCG",
    categoryId: EBAY_CCG_INDIVIDUAL_CATEGORY,
    emptyMessage: "No One Piece TCG auctions ending soon — try again shortly.",
  },
  {
    id: "onepiece-psa10",
    label: "One Piece PSA 10",
    shortLabel: "OP PSA 10",
    query: "One Piece PSA 10",
    categoryId: EBAY_CCG_INDIVIDUAL_CATEGORY,
    emptyMessage: "No One Piece PSA 10 auctions ending soon — try again shortly.",
  },
];

export const DEFAULT_EBAY_ENDING_SOON_FEED_ID: EbayEndingSoonFeedId = "pokemon-psa10";

const FEED_BY_ID = new Map(EBAY_ENDING_SOON_FEEDS.map((f) => [f.id, f]));

export function resolveEbayEndingSoonFeed(
  feedId: string | null | undefined,
): EbayEndingSoonFeedDef {
  const id = feedId?.trim() as EbayEndingSoonFeedId | undefined;
  if (id && FEED_BY_ID.has(id)) return FEED_BY_ID.get(id)!;
  return FEED_BY_ID.get(DEFAULT_EBAY_ENDING_SOON_FEED_ID)!;
}

export function ebayEndingSoonHubUrl(feed: EbayEndingSoonFeedDef): string {
  return buildHubUrl(feed.query, feed.categoryId);
}

/** @deprecated Use feed-specific hub from `ebayEndingSoonHubUrl`. */
export const EBAY_ENDING_SOON_HUB_URL = buildHubUrl("Pokemon", EBAY_CCG_INDIVIDUAL_CATEGORY);
