import type { ExtractedCard, MarketEvidence } from "@/lib/scan/schemas";
import { classifyCardLane } from "@/lib/scan/lane";
import { franchiseSearchPrefix, inferCardFranchise } from "@/lib/scan/franchise";
import {
  buildCardLadderLadderSearchUrl,
  cardLadderHubUrls,
  cardLadderLadderSearchQuery,
} from "@/lib/market/cardladder-urls";
import { buildMarketSearchIdentity } from "@/lib/market/market-search-identity";
import { isJapanesePokemonCard, japaneseMarketIdentityParts } from "@/lib/scan/japanese-pokemon";
import {
  buildEbayCardKeywordQuery,
  ebaySearchCategoryIdForCard,
} from "@/lib/market/ebay-sold-common";

export type MarketSourceId =
  | "ebay"
  | "cardladder"
  | "alt"
  | "goldin"
  | "fanatics"
  | "pricecharting"
  | "cardmarket"
  | "tcgplayer";

export type MarketSourceLink = {
  source: MarketSourceId;
  label: string;
  lane: "sold" | "active";
  url: string;
};

export type HubLaneUrls = { sold: string | null; active: string | null };

/** Merge sold/active hub URLs from persisted links (used to override dead listing URLs in UI). */
export function buildHubUrlMap(links: MarketSourceLink[]): Map<MarketSourceId, HubLaneUrls> {
  const hub = new Map<MarketSourceId, HubLaneUrls>();
  for (const link of links) {
    const cur = hub.get(link.source) ?? { sold: null, active: null };
    if (link.lane === "sold") cur.sold = link.url;
    else cur.active = link.url;
    hub.set(link.source, cur);
  }
  return hub;
}

/** Prefer active (listings) for “open marketplace”; fall back to sold comps search. */
export function preferredHubBrowseUrl(lanes: HubLaneUrls | undefined): string | null {
  if (!lanes) return null;
  return lanes.active ?? lanes.sold;
}

function isEbayItemUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase();
    return /\/itm\//.test(path) || /\/p\//.test(path);
  } catch {
    return false;
  }
}

/** Compact listing title into a sold-search query when we must not deep-link to /itm/ (sign-in wall). */
function ebaySoldSearchQueryFromCompTitle(title: string): string {
  const t = title
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return t;
}

/** eBay completed listings search (Pokémon TCG category, newest ended first). */
export function buildEbaySoldSearchUrl(query: string): string {
  const params = new URLSearchParams({
    _nkw: query.trim(),
    LH_Sold: "1",
    LH_Complete: "1",
    _sop: "1",
    rt: "nc",
  });
  return `https://www.ebay.com/sch/i.html?${params.toString()}`;
}

export function buildEbayActiveSearchUrl(query: string): string {
  const params = new URLSearchParams({
    _nkw: query.trim(),
    rt: "nc",
  });
  return `https://www.ebay.com/sch/i.html?${params.toString()}`;
}

function buildEbaySoldSearchUrlForCard(card: ExtractedCard, query: string): string {
  const params = new URLSearchParams({
    _nkw: query.trim(),
    LH_Sold: "1",
    LH_Complete: "1",
    _sop: "1",
    rt: "nc",
  });
  const categoryId = ebaySearchCategoryIdForCard(card);
  if (categoryId) params.set("_sacat", categoryId);
  return `https://www.ebay.com/sch/i.html?${params.toString()}`;
}

function buildEbayActiveSearchUrlForCard(card: ExtractedCard, query: string): string {
  const params = new URLSearchParams({
    _nkw: query.trim(),
    rt: "nc",
  });
  const categoryId = ebaySearchCategoryIdForCard(card);
  if (categoryId) params.set("_sacat", categoryId);
  return `https://www.ebay.com/sch/i.html?${params.toString()}`;
}

export type EbayGradeHubKey =
  | "raw"
  | "psa10"
  | "psa9"
  | "bgsBlackLabel"
  | "cgcPristine10";

export type EbayGradeHub = { sold: string; active: string };

/** eBay sold + active hubs for the scanned card (same query as scrape / listed links). */
export function buildEbayHubForCard(card: ExtractedCard): EbayGradeHub {
  const q = buildEbayCardKeywordQuery(card);
  return {
    sold: buildEbaySoldSearchUrlForCard(card, q),
    active: buildEbayActiveSearchUrlForCard(card, q),
  };
}

export function buildEbayGradeHubs(card: ExtractedCard): Record<EbayGradeHubKey, EbayGradeHub> {
  const hubFor = (c: ExtractedCard): EbayGradeHub => {
    const q = buildEbayCardKeywordQuery(c);
    return {
      sold: buildEbaySoldSearchUrlForCard(c, q),
      active: buildEbayActiveSearchUrlForCard(c, q),
    };
  };
  return {
    raw: hubFor({ ...card, grader: undefined, grade: undefined }),
    psa10: hubFor({ ...card, grader: "PSA", grade: "10" }),
    psa9: hubFor({ ...card, grader: "PSA", grade: "9" }),
    bgsBlackLabel: hubFor({ ...card, grader: "BGS", grade: "10 Black Label" }),
    cgcPristine10: hubFor({ ...card, grader: "CGC", grade: "10 Pristine" }),
  };
}

export function resolveEvidenceExternalUrl(
  item: MarketEvidence,
  hub: Map<MarketSourceId, HubLaneUrls>,
  options?: { ebayGradeHub?: EbayGradeHub; ebayCardHub?: EbayGradeHub },
): string | null {
  const fromUrl = item.url ? inferMarketSourceFromUrl(item.url) : null;
  const fromName = normalizeMarketSource(item.source ?? null);
  const sourceId = fromUrl ?? fromName;
  const looksLikeEbayUrl = Boolean(item.url && /ebay\.(com|co\.uk|de|fr|ca)/i.test(item.url));

  if (sourceId === "ebay" || looksLikeEbayUrl) {
    const gradeHub = options?.ebayGradeHub;
    if (item.kind === "sold") {
      const soldHub = gradeHub?.sold?.trim() || hub.get("ebay")?.sold?.trim();
      if (soldHub) return soldHub;
      if (item.url && !isEbayItemUrl(item.url)) return item.url;
      // Completed auction item pages often redirect to sign-in; open sold search instead.
      const q = ebaySoldSearchQueryFromCompTitle(item.title);
      if (q) return buildEbaySoldSearchUrl(q);
      return null;
    }
    if (item.kind === "active") {
      if (gradeHub?.active?.trim()) return gradeHub.active.trim();
      const lanes = hub.get("ebay");
      if (lanes?.active?.trim()) return lanes.active.trim();
      if (item.url && !isEbayItemUrl(item.url)) return item.url;
      return item.url ?? null;
    }
  }

  if (sourceId) {
    const lanes = hub.get(sourceId);
    if (lanes) {
      if (item.kind === "sold") return lanes.sold ?? item.url ?? null;
      if (item.kind === "active") return lanes.active ?? item.url ?? null;
      return preferredHubBrowseUrl(lanes) ?? item.url ?? null;
    }
  }

  if (item.kind === "sold" && item.url && isEbayItemUrl(item.url) && looksLikeEbayUrl) {
    const soldHub = hub.get("ebay")?.sold?.trim();
    if (soldHub) return soldHub;
    const q = ebaySoldSearchQueryFromCompTitle(item.title);
    return q ? buildEbaySoldSearchUrl(q) : null;
  }

  return item.url ?? null;
}

export type MarketSourceDefinition = {
  id: MarketSourceId;
  label: string;
  domain: string;
  soldUrl: (query: string) => string;
  activeUrl: (query: string) => string;
  soldSearchQuery: (card: ExtractedCard) => string;
  activeSearchQuery: (card: ExtractedCard) => string;
};

function compact(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function identity(card: ExtractedCard): string {
  if (isJapanesePokemonCard(card)) {
    return compact([franchiseSearchPrefix(card), ...japaneseMarketIdentityParts(card)]);
  }
  return compact([franchiseSearchPrefix(card), card.name, card.printedName, card.language, card.set, card.number, card.printStamps, card.details, card.rarity, card.year]);
}

function gradedIdentity(card: ExtractedCard): string {
  return buildMarketSearchIdentity(card).platform;
}

function cardMarketGamePath(card: ExtractedCard): string {
  switch (inferCardFranchise(card).id) {
    case "pokemon":
      return "Pokemon";
    case "onepiece":
      return "OnePiece";
    case "dragonball":
      return "DragonBallSuper";
    case "yugioh":
      return "YuGiOh";
    case "magic":
      return "Magic";
    case "lorcana":
      return "Lorcana";
    case "sports":
      return "Sports-Trading-Cards";
    default:
      return "Search";
  }
}

export const MARKET_SOURCES: MarketSourceDefinition[] = [
  {
    id: "ebay",
    label: "eBay",
    domain: "ebay.com",
    soldUrl: (query) => buildEbaySoldSearchUrl(query),
    activeUrl: (query) => buildEbayActiveSearchUrl(query),
    soldSearchQuery: (card) => buildEbayCardKeywordQuery(card),
    activeSearchQuery: (card) => buildEbayCardKeywordQuery(card),
  },
  {
    id: "cardladder",
    label: "Card Ladder",
    domain: "cardladder.com",
    soldUrl: (query) => buildCardLadderLadderSearchUrl(query),
    activeUrl: (query) => buildCardLadderLadderSearchUrl(query),
    soldSearchQuery: (card) => cardLadderLadderSearchQuery(card),
    activeSearchQuery: (card) => cardLadderLadderSearchQuery(card),
  },
  {
    id: "alt",
    label: "ALT",
    domain: "alt.xyz",
    soldUrl: (query) => `https://app.alt.xyz/browse?q=${encodeURIComponent(query)}`,
    activeUrl: (query) => `https://app.alt.xyz/browse?q=${encodeURIComponent(query)}`,
    soldSearchQuery: (card) => gradedIdentity(card) || identity(card),
    activeSearchQuery: (card) => gradedIdentity(card) || identity(card),
  },
  {
    id: "goldin",
    label: "Goldin",
    domain: "goldin.co",
    soldUrl: (query) => `https://goldin.co/search?search=${encodeURIComponent(query)}`,
    activeUrl: (query) => `https://goldin.co/search?search=${encodeURIComponent(query)}`,
    soldSearchQuery: (card) => gradedIdentity(card) || identity(card),
    activeSearchQuery: (card) => gradedIdentity(card) || identity(card),
  },
  {
    id: "fanatics",
    label: "Fanatics Collect",
    domain: "fanaticscollect.com",
    soldUrl: (query) =>
      `https://www.fanaticscollect.com/search?query=${encodeURIComponent(query)}&sort=price_desc`,
    activeUrl: (query) =>
      `https://www.fanaticscollect.com/search?query=${encodeURIComponent(query)}`,
    soldSearchQuery: (card) => gradedIdentity(card) || identity(card),
    activeSearchQuery: (card) => gradedIdentity(card) || identity(card),
  },
  {
    id: "pricecharting",
    label: "PriceCharting",
    domain: "pricecharting.com",
    soldUrl: (query) => `https://www.pricecharting.com/search-products?q=${encodeURIComponent(query)}&type=prices`,
    activeUrl: (query) => `https://www.pricecharting.com/search-products?q=${encodeURIComponent(query)}&type=prices`,
    soldSearchQuery: (card) => compact([identity(card), "sold price"]),
    activeSearchQuery: (card) => compact([identity(card), "price"]),
  },
  {
    id: "cardmarket",
    label: "CardMarket",
    domain: "cardmarket.com",
    soldUrl: (query) =>
      `https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=${encodeURIComponent(query)}`,
    activeUrl: (query) =>
      `https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=${encodeURIComponent(query)}`,
    soldSearchQuery: (card) => compact([identity(card), "sold"]),
    activeSearchQuery: (card) => identity(card),
  },
  {
    id: "tcgplayer",
    label: "TCGPlayer",
    domain: "tcgplayer.com",
    soldUrl: (query) => `https://www.tcgplayer.com/search/all/product?q=${encodeURIComponent(query)}`,
    activeUrl: (query) => `https://www.tcgplayer.com/search/all/product?q=${encodeURIComponent(query)}`,
    soldSearchQuery: (card) => compact([identity(card), "market price"]),
    activeSearchQuery: (card) => identity(card),
  },
];

export function buildMarketSourceLinks(card: ExtractedCard): MarketSourceLink[] {
  const { lane } = classifyCardLane(card as Record<string, unknown>);
  const defs = lane === "raw" ? MARKET_SOURCES.filter((s) => s.id !== "goldin") : MARKET_SOURCES;
  return defs.flatMap((source): MarketSourceLink[] => {
    if (source.id === "cardladder") {
      const { sold, active } = cardLadderHubUrls(card);
      return [
        { source: "cardladder", label: `${source.label} sold`, lane: "sold" as const, url: sold },
        { source: "cardladder", label: `${source.label} listed`, lane: "active" as const, url: active },
      ];
    }
    if (source.id === "ebay") {
      const soldQuery = source.soldSearchQuery(card);
      const activeQuery = source.activeSearchQuery(card);
      return [
        {
          source: source.id,
          label: `${source.label} sold`,
          lane: "sold",
          url: buildEbaySoldSearchUrlForCard(card, soldQuery),
        },
        {
          source: source.id,
          label: `${source.label} listed`,
          lane: "active",
          url: buildEbayActiveSearchUrlForCard(card, activeQuery),
        },
      ];
    }
    if (source.id === "cardmarket") {
      const gamePath = cardMarketGamePath(card);
      const soldQuery = source.soldSearchQuery(card);
      const activeQuery = source.activeSearchQuery(card);
      return [
        {
          source: source.id,
          label: `${source.label} sold`,
          lane: "sold",
          url: `https://www.cardmarket.com/en/${gamePath}/Products/Search?searchString=${encodeURIComponent(soldQuery)}`,
        },
        {
          source: source.id,
          label: `${source.label} listed`,
          lane: "active",
          url: `https://www.cardmarket.com/en/${gamePath}/Products/Search?searchString=${encodeURIComponent(activeQuery)}`,
        },
      ];
    }
    return [
      {
        source: source.id,
        label: `${source.label} sold`,
        lane: "sold" as const,
        url: source.soldUrl(source.soldSearchQuery(card)),
      },
      {
        source: source.id,
        label: `${source.label} listed`,
        lane: "active" as const,
        url: source.activeUrl(source.activeSearchQuery(card)),
      },
    ];
  });
}

export function inferMarketSourceFromUrl(url: string): MarketSourceId | null {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("ebay.")) return "ebay";
    if (host.includes("cardladder.")) return "cardladder";
    if (host.includes("alt.xyz") || host.includes("alt.")) return "alt";
    if (host.includes("goldin.")) return "goldin";
    if (host.includes("fanatics")) return "fanatics";
    if (host.includes("pricecharting.")) return "pricecharting";
    if (host.includes("cardmarket.")) return "cardmarket";
    if (host.includes("tcgplayer.")) return "tcgplayer";
  } catch {
    return null;
  }
  return null;
}

export function normalizeMarketSource(value: string | null | undefined): MarketSourceId | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "null" || normalized === "undefined") return null;
  if (normalized.includes("ebay")) return "ebay";
  if (normalized.includes("card ladder") || normalized.includes("cardladder")) return "cardladder";
  if (normalized === "alt" || /^alt\s/i.test(normalized) || normalized.startsWith("alt.")) return "alt";
  if (normalized.includes("goldin")) return "goldin";
  if (normalized.includes("fanatics")) return "fanatics";
  if (normalized.includes("pricecharting") || normalized.includes("price charting")) return "pricecharting";
  if (normalized.includes("cardmarket") || normalized.includes("card market")) return "cardmarket";
  if (normalized.includes("tcgplayer") || normalized.includes("tcg player")) return "tcgplayer";
  return null;
}

export function sourceLabel(source: MarketSourceId): string {
  return MARKET_SOURCES.find((entry) => entry.id === source)?.label ?? source;
}
