/** Structured set insight for Master Catalog / Liquid Scan (catalog + Groq web research). */

export type SetInsightPriceCard = {
  catalogId?: string | null;
  name: string;
  number?: string | null;
  rarity?: string | null;
  imageUrl?: string | null;
  priceUsd?: number | null;
  /** SOLD | ACTIVE | REFERENCE | TCGPlayer market | etc. */
  priceLabel?: string | null;
  momentumPct?: number | null;
  note?: string | null;
};

export type SetInsightSealedProduct = {
  label: string;
  priceUsd?: number | null;
  priceLabel?: string | null;
  note?: string | null;
  searchUrl?: string | null;
};

export type CatalogSetInsightPayload = {
  ready: boolean;
  setId: string;
  setName: string;
  releaseDate?: string | null;
  refreshedAt: string;
  source: "catalog" | "groq" | "hybrid";
  model?: string | null;
  error?: string | null;

  /** 2–3 sentence market overview. */
  summary?: string | null;
  /** One-line pulse (trend / liquidity). */
  marketPulse?: string | null;
  /** Collector / chase angle. */
  chaseNotes?: string | null;
  /** Editorial context (overlay notes + AI collector pulse). */
  editorialNotes?: string | null;
  /** Top chase card for set header / hero. */
  chaseCard?: SetInsightPriceCard | null;
  /** Canonical SKU label for the set lead chase (e.g. `me4-116`). */
  chaseSku?: string | null;

  setWide: {
    cardCount: number;
    tcgPlayerSumUsd: number;
    pricedSlots: number;
    pricedPct: number;
  };

  topValue: SetInsightPriceCard[];
  momentum: SetInsightPriceCard[];
  promos: SetInsightPriceCard[];
  sealedProducts: SetInsightSealedProduct[];
  references: { label: string; url: string }[];
};
