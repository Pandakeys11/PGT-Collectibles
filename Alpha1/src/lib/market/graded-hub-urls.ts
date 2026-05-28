import type { ExtractedCard } from "@/lib/scan/schemas";
import { buildMarketSearchIdentity } from "@/lib/market/market-search-identity";
import { buildEbayHubForCard } from "@/lib/market/sources";
import {
  buildCardLadderCardPageUrl,
  buildCardLadderSearchUrlForCert,
  cardLadderHubUrls,
} from "@/lib/market/cardladder-urls";

export type GradedHubLink = {
  platform: "ebay_sold" | "ebay_active" | "cardladder" | "alt" | "goldin" | "registry";
  label: string;
  url: string;
  lane: "sold" | "active" | "reference";
};

export function buildAltBrowseUrl(query: string, lane: "sold" | "active" = "active"): string {
  const trimmed = query.trim() || "Pokemon";
  const q = lane === "sold" ? `${trimmed} sold comps`.replace(/\s+/g, " ").trim() : trimmed;
  return `https://app.alt.xyz/browse?q=${encodeURIComponent(q)}`;
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
  const clDeep = Boolean(buildCardLadderCardPageUrl(card));
  links.push({
    platform: "cardladder",
    label: clDeep ? "Card Ladder · grade page" : "Card Ladder · sold comps",
    url: cl.sold,
    lane: "sold",
  });

  const certDigits = card.cert?.replace(/\D/g, "") ?? "";
  if (certDigits.length >= 6) {
    const certUrl = buildCardLadderSearchUrlForCert(card.grader ?? "PSA", certDigits);
    if (certUrl !== cl.sold) {
      links.push({
        platform: "cardladder",
        label: "Card Ladder · cert search",
        url: certUrl,
        lane: "sold",
      });
    }
  }

  links.push({
    platform: "alt",
    label: "ALT · sold comps",
    url: buildAltBrowseUrl(searchId.platform, "sold"),
    lane: "sold",
  });
  links.push({
    platform: "alt",
    label: "ALT · listings",
    url: buildAltBrowseUrl(searchId.platform, "active"),
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
