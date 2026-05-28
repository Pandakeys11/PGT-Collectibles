export type JustTcgVariant = {
  id?: string;
  condition?: string;
  printing?: string;
  price?: number;
  low?: number;
  high?: number;
  avg?: number;
  lastUpdated?: string;
  lastUpdatedAt?: string;
};

export type JustTcgCard = {
  id: string;
  name: string;
  game?: string;
  set?: string;
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
