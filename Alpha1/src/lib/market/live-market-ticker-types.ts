/** Lane shown on one of the three live market pills. */
export type LiveMarketTickerLaneId = "top_value" | "momentum" | "spotlight" | "jpn_art";

/** One auto-cycle frame in a lane (usually one highlight per Pokémon set). */
export type LiveMarketTickerSlide = {
  lane: LiveMarketTickerLaneId;
  setId: string;
  setName: string;
  setCode: string | null;
  releaseYear: string | null;
  catalogId: string;
  cardName: string;
  cardNumber: string | null;
  rarity: string | null;
  imageUrl: string | null;
  priceUsd: number | null;
  /** TCGPlayer / Cardmarket reference from catalog cache. */
  tcgMarketUsd?: number | null;
  /** PGT comp median — raw / ungraded. */
  rawFmvUsd?: number | null;
  /** PGT comp median — PSA 10 bucket. */
  psa10FmvUsd?: number | null;
  /** Secondary metric for momentum lane (% vs 7d avg). */
  momentumPct?: number | null;
  priceLabel: string;
};

export type LiveMarketTickerLane = {
  id: LiveMarketTickerLaneId;
  label: string;
  subtitle: string;
  slides: LiveMarketTickerSlide[];
};

export type LiveMarketTickerPayload = {
  ready: boolean;
  lanes: LiveMarketTickerLane[];
  /** Flattened slides (all lanes) for panel stepping. */
  slides: LiveMarketTickerSlide[];
  setCount: number;
  /** Sets with a banner-ready top-value highlight. */
  topValueCount?: number;
  refreshedAt: string;
  error?: string;
};

/** Composer banner: EN top value, EN momentum, validated Japanese art tour. */
export const LIVE_MARKET_TICKER_LANE_ORDER: LiveMarketTickerLaneId[] = [
  "top_value",
  "momentum",
  "jpn_art",
];

export const LIVE_MARKET_TICKER_PANEL_LANE_ORDER: LiveMarketTickerLaneId[] = [
  "top_value",
  "momentum",
  "jpn_art",
  "spotlight",
];
