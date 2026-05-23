import type { ExtractedCard } from "@/lib/scan/schemas";
import { buildMarketSearchIdentity } from "@/lib/market/market-search-identity";
import { buildEbayHubForCard } from "@/lib/market/sources";
import { buildCardLadderSearchUrlForCert, cardLadderHubUrls } from "@/lib/market/cardladder-urls";

export type GradedHubLink = {
  platform: "ebay_sold" | "ebay_active" | "cardladder" | "alt" | "goldin" | "registry";
  label: string;
  url: string;
  lane: "sold" | "active" | "reference";
};

function compact(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

export function buildAltBrowseUrl(query: string): string {
  return `https://app.alt.xyz/browse?q=${encodeURIComponent(query)}`;
}

export function buildGoldinSearchUrl(query: string): string {
  return `https://goldin.co/search?search=${encodeURIComponent(query)}`;
}

/** One-click hubs for graded research UI (Card Ladder, ALT, eBay). */
export function buildGradedHubLinks(
  card: ExtractedCard,
  options?: { registryUrl?: string | null },
): GradedHubLink[] {
  const links: GradedHubLink[] = [];
  const searchId = buildMarketSearchIdentity(card);
  const ebayHub = buildEbayHubForCard(card);

  links.push({
    platform: "ebay_sold",
    label: "eBay sold",
    url: ebayHub.sold,
    lane: "sold",
  });
  links.push({
    platform: "ebay_active",
    label: "eBay listings",
    url: ebayHub.active,
    lane: "active",
  });

  const cl = cardLadderHubUrls(card);
  links.push({
    platform: "cardladder",
    label: "Card Ladder sales",
    url: cl.sold,
    lane: "sold",
  });

  const certDigits = card.cert?.replace(/\D/g, "") ?? "";
  if (certDigits.length >= 6) {
    const certUrl = buildCardLadderSearchUrlForCert(card.grader ?? "PSA", certDigits);
    links.push({
      platform: "cardladder",
      label: "Card Ladder · cert search",
      url: certUrl,
      lane: "sold",
    });
  }

  links.push({
    platform: "alt",
    label: "ALT marketplace",
    url: buildAltBrowseUrl(searchId.platform),
    lane: "active",
  });

  links.push({
    platform: "goldin",
    label: "Goldin auctions",
    url: buildGoldinSearchUrl(searchId.platform),
    lane: "sold",
  });

  if (options?.registryUrl) {
    links.push({
      platform: "registry",
      label: "Grader registry",
      url: options.registryUrl,
      lane: "reference",
    });
  }

  return links;
}
