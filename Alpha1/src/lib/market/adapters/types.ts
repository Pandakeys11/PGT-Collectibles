import type { MarketEvidence } from "@/lib/scan/schemas";
import type { ExtractedCard } from "@/lib/scan/schemas";

export type ApiAdapterId =
  | "ebay_browse"
  | "ebay_sold_scrape"
  | "pricecharting"
  | "pokemon_tcg_prices";

export type ApiAdapterResult = {
  adapter: ApiAdapterId;
  evidence: MarketEvidence[];
  /** Non-fatal errors for logging / future UI */
  warnings?: string[];
};

export type MarketApiAdapter = {
  id: ApiAdapterId;
  /** Runs only when env is configured; must return quickly on failure */
  collect: (card: ExtractedCard) => Promise<ApiAdapterResult>;
};
