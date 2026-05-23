import type { CardFranchise } from "@/lib/scan/franchise";

export type CatalogSourceMeta = {
  id: string;
  franchise: CardFranchise | "sports";
  label: string;
  apiBaseUrl: string;
  licenseNotes: string;
  /** Primary matching strategy at scan time */
  matchStrategy: "live_api" | "db_cache" | "web_fallback";
};

/** Authoritative free sources per franchise (scan + sync). */
export const CATALOG_SOURCES: Record<string, CatalogSourceMeta> = {
  pokemon: {
    id: "pokemontcg.io",
    franchise: "pokemon",
    label: "Pokemon TCG API",
    apiBaseUrl: "https://api.pokemontcg.io/v2",
    licenseNotes: "Official Pokemon TCG API; optional POKEMON_TCG_API_KEY",
    matchStrategy: "live_api",
  },
  magic: {
    id: "scryfall.com",
    franchise: "magic",
    label: "Scryfall",
    apiBaseUrl: "https://api.scryfall.com",
    licenseNotes: "Free MTG API; User-Agent required; cache bulk 24h+",
    matchStrategy: "live_api",
  },
  yugioh: {
    id: "ygoprodeck.com",
    franchise: "yugioh",
    label: "YGOPRODeck",
    apiBaseUrl: "https://db.ygoprodeck.com/api/v7",
    licenseNotes: "Free; prefer local DB sync (20 req/s limit)",
    matchStrategy: "live_api",
  },
  onepiece: {
    id: "optcgapi.com",
    franchise: "onepiece",
    label: "OPTCG API",
    apiBaseUrl: "https://optcgapi.com/api",
    licenseNotes: "Free GET-only; rate-conscious",
    matchStrategy: "live_api",
  },
  lorcana: {
    id: "lorcast.com",
    franchise: "lorcana",
    label: "Lorcast",
    apiBaseUrl: "https://api.lorcast.com/v0",
    licenseNotes: "Free Lorcana API; ~10 req/s",
    matchStrategy: "live_api",
  },
  dragonball: {
    id: "apitcg.com",
    franchise: "dragonball",
    label: "Api TCG (Dragon Ball FW)",
    apiBaseUrl: "https://apitcg.com/api",
    licenseNotes: "APITCG_API_KEY for sync; scan uses web fallback without key",
    matchStrategy: "web_fallback",
  },
  sports: {
    id: "pricecharting.com",
    franchise: "sports",
    label: "PriceCharting + PSA/130point",
    apiBaseUrl: "https://www.pricecharting.com",
    licenseNotes: "No unified sports card API; market via PriceCharting/eBay",
    matchStrategy: "web_fallback",
  },
};

export function catalogSourceForFranchise(franchise: CardFranchise): CatalogSourceMeta {
  return CATALOG_SOURCES[franchise] ?? CATALOG_SOURCES.sports;
}
