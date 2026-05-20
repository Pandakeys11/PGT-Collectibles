import type { ExtractedCard } from "@/lib/scan/schemas";
import { MARKET_SOURCES, type MarketSourceId } from "@/lib/market/sources";

export type MarketQuerySet = {
  rawSold: string;
  active: string;
  psa10Sold: string;
  bgsBlackLabelSold: string;
  bySource: Record<MarketSourceId, { sold: string; active: string }>;
};

function compact(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function siteQuery(domain: string, query: string): string {
  return `site:${domain} ${query}`;
}

export function buildMarketQueries(card: ExtractedCard): MarketQuerySet {
  const identity = compact([
    card.name,
    card.printedName,
    card.language,
    card.set,
    card.number,
    card.printStamps,
    card.details,
    card.rarity,
    card.year,
  ]);
  const graded = compact([
    card.name,
    card.printedName,
    card.language,
    card.set,
    card.number,
    card.printStamps,
    card.details,
    card.grader,
    card.grade,
  ]);

  const bySource = Object.fromEntries(
    MARKET_SOURCES.map((source) => [
      source.id,
      {
        sold: siteQuery(source.domain, source.soldSearchQuery(card)),
        active: siteQuery(source.domain, source.activeSearchQuery(card)),
      },
    ]),
  ) as MarketQuerySet["bySource"];

  return {
    rawSold: compact([identity, "pokemon card sold price"]),
    active: compact([identity, "pokemon card for sale"]),
    psa10Sold: compact([graded || identity, "PSA 10", "sold"]),
    bgsBlackLabelSold: compact([graded || identity, "BGS", "Black Label", "sold"]),
    bySource,
  };
}
