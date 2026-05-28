/** Types for Pokémon TCG API v2 (https://docs.pokemontcg.io/) */

export type TcgSetSummary = {
  id: string;
  name: string;
  series: string;
  printedTotal: number;
  total: number;
  releaseDate: string;
  images?: { symbol?: string; logo?: string };
};

/** Set object embedded on card payloads from the TCG API */
export type TcgCardSetEmbed = {
  id: string;
  name: string;
  series?: string;
  releaseDate?: string;
  printedTotal?: number;
  total?: number;
};

export type TcgCardSummary = {
  id: string;
  name: string;
  number: string;
  rarity?: string;
  supertype?: string;
  subtypes?: string[];
  hp?: string;
  artist?: string;
  images?: { small?: string; large?: string };
  set?: TcgCardSetEmbed;
  tcgplayer?: {
    url?: string;
    updatedAt?: string;
    prices?: Record<string, { low?: number; mid?: number; high?: number; market?: number; directLow?: number }>;
  };
  cardmarket?: {
    url?: string;
    updatedAt?: string;
    prices?: {
      averageSellPrice?: number;
      trendPrice?: number;
      lowPrice?: number;
      avg7?: number;
      avg30?: number;
      reverseHoloTrend?: number;
    };
  };
  /**
   * Legendary Collection (`base6`): API is one row per number; physical reverse holos are a second
   * display row (same official image) — used for grid keys and reverse holo market bias.
   */
  catalogFinish?: "reverse_holo";
  catalogVariantKey?: string | null;
  catalogVariantLabel?: string | null;
  sourceCatalogId?: string | null;
  /** Parsed `tcg_catalog_cards.prices_json` when loaded from master DB. */
  catalogPrices?: import("@/lib/market/pokemon-catalog").CatalogPriceSnapshot;
};

/** Full card payload from `GET /v2/cards/:id` (pricing fields used in catalog detail). */
export type TcgCardDetail = TcgCardSummary & {
  tcgplayer?: {
    url?: string;
    updatedAt?: string;
    prices?: Record<string, { low?: number; mid?: number; high?: number; market?: number; directLow?: number }>;
  };
  cardmarket?: {
    url?: string;
    updatedAt?: string;
    prices?: {
      averageSellPrice?: number;
      trendPrice?: number;
      lowPrice?: number;
      avg7?: number;
      avg30?: number;
      reverseHoloTrend?: number;
    };
  };
};

export type TcgPaginated<T> = {
  data: T[];
  page: number;
  pageSize: number;
  count: number;
  totalCount: number;
};

/** First calendar year from API releaseDate (YYYY/MM/DD). */
export function releaseYearFromApiDate(releaseDate: string | null | undefined): string | null {
  if (!releaseDate?.trim()) return null;
  const y = releaseDate.trim().slice(0, 4);
  return /^\d{4}$/.test(y) ? y : null;
}
