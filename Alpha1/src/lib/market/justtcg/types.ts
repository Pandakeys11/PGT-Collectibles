export type JustTcgVariant = {
  id?: string;
  condition?: string;
  printing?: string;
  language?: string;
  tcgplayerSkuId?: string;
  price?: number;
  low?: number;
  high?: number;
  avg?: number;
  lastUpdated?: string | number;
  lastUpdatedAt?: string;
  priceChange24hr?: number | null;
  priceChange7d?: number | null;
  priceChange30d?: number | null;
  avgPrice?: number | null;
  avgPrice30d?: number | null;
  minPrice7d?: number | null;
  maxPrice7d?: number | null;
  minPrice30d?: number | null;
  maxPrice30d?: number | null;
  priceHistory?: unknown;
};

export type JustTcgCard = {
  id: string;
  name: string;
  game?: string;
  set?: string;
  set_name?: string;
  number?: string;
  rarity?: string;
  tcgplayerId?: string | number | null;
  details?: string | null;
  variants?: JustTcgVariant[];
};

export type JustTcgUsage = {
  apiPlan?: string;
  apiRequestLimit?: number;
  apiDailyLimit?: number;
  apiRequestsUsed?: number;
  apiDailyRequestsUsed?: number;
  apiRequestsRemaining?: number;
  apiDailyRequestsRemaining?: number;
};

export type JustTcgListResponse = {
  data?: JustTcgCard[];
  meta?: Record<string, unknown>;
  usage?: JustTcgUsage;
  error?: string;
  code?: string;
};

export type JustTcgBatchLookupItem = {
  tcgplayerId?: string;
  game?: string;
  set?: string;
  number?: string;
  query?: string;
};
