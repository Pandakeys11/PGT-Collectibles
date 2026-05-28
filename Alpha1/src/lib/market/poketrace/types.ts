import type { GradeBucket } from "@/lib/market/market-intelligence";

export type PokeTracePriceSource =
  | "ebay"
  | "tcgplayer"
  | "cardmarket"
  | "cardmarket_unsold";

export type PokeTraceTierPrice = {
  avg?: number;
  low?: number;
  high?: number;
  saleCount?: number;
  approxSaleCount?: boolean | number;
  median3d?: number;
  median7d?: number;
  median30d?: number;
  avg1d?: number;
  avg7d?: number;
  avg30d?: number;
  lastUpdated?: string;
};

export type PokeTraceCard = {
  id: string;
  name: string;
  cardNumber?: string;
  set?: { slug?: string; name?: string };
  variant?: string;
  game?: string;
  refs?: { tcgplayerId?: string | null };
  prices?: Partial<Record<PokeTracePriceSource, Record<string, unknown>>>;
  lastUpdated?: string;
};

export type PokeTraceHistoryPoint = {
  date: string;
  source?: string;
  avg?: number;
  low?: number;
  high?: number;
  saleCount?: number;
  median7d?: number;
  median30d?: number;
  avg7d?: number;
  avg30d?: number;
};

export type PokeTraceRealtimeUpdate = {
  cardId: string;
  source: string;
  tier: string | null;
  priceUsd: number;
  currency: string;
  trendPct: number | null;
  anomalyFlag: boolean;
  observedAt: string;
};

export type PokeTraceWsEvent =
  | { event: "connected"; data?: { message?: string } }
  | {
      event: "price.card-updated";
      data: {
        id: string;
        source: string;
        tier?: string;
        price: number;
        currency?: string;
        avg7d?: number;
        avg30d?: number;
      };
      timestamp?: string;
    }
  | { type: "ping" }
  | { type: "pong" };

export type PokeTraceTierContext = {
  tier: string;
  sourceKey: PokeTracePriceSource;
  row: PokeTraceTierPrice;
  gradeBucket?: GradeBucket;
};
