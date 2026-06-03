import { buildMarketSourceLinks } from "@/lib/market/sources";
import type { ExtractedCard } from "@/lib/scan/schemas";
import type { MarketSourceBrand } from "@/lib/scan/specimen-market-view";

const SOURCE_BRAND: Record<string, { accent: string; tagline: string }> = {
  ebay: { accent: "#e53238", tagline: "Search sold & live listings" },
  tcgplayer: { accent: "#0a7ea4", tagline: "TCGPlayer market" },
  cardmarket: { accent: "#012169", tagline: "EU marketplace" },
  pricecharting: { accent: "#f59e0b", tagline: "Price guide" },
  cardladder: { accent: "#8b5cf6", tagline: "Sales index" },
  alt: { accent: "#10b981", tagline: "Alt analytics" },
  goldin: { accent: "#d97706", tagline: "Auction house" },
  fanatics: { accent: "#1d4ed8", tagline: "Fanatics Collect" },
  oneThirtyPoint: { accent: "#f97316", tagline: "Cross-market sold history" },
};

function idleSearchCard(hotSetName?: string | null): ExtractedCard {
  if (hotSetName?.trim()) {
    return {
      name: "Pokemon TCG chase",
      set: hotSetName.trim(),
      franchise: "pokemon",
    };
  }
  return {
    name: "Pokemon TCG",
    set: "Trading Card Game",
    franchise: "pokemon",
  };
}

/** Generic Pokémon TCG hub links for idle market intelligence (mirrors per-card source ads). */
export function buildIdleMarketSourceBrands(hotSetName?: string | null): MarketSourceBrand[] {
  const links = buildMarketSourceLinks(idleSearchCard(hotSetName));
  return links.map((link) => {
    const brand = SOURCE_BRAND[link.source] ?? {
      accent: "#64748b",
      tagline: "Open market search",
    };
    return {
      id: `${link.source}-${link.lane}`,
      label: link.label.replace(/\s+(sold|listed|active)$/i, "").trim() || link.label,
      lane: link.lane,
      url: link.url,
      accent: brand.accent,
      tagline: brand.tagline,
    };
  });
}
