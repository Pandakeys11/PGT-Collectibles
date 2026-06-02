/** Structured research returned with Liquid Vault Ask (shown in rich UI). */
export type LiquidAskComp = {
  kind: "sold" | "active" | "reference";
  title: string;
  priceUsd: number | null;
  observedAt: string | null;
  url: string | null;
  source: string | null;
  slab: string | null;
  imageUrl?: string | null;
};

export type LiquidAskSource = {
  label: string;
  url: string;
  snippet?: string | null;
};

export type LiquidAskCertLookup = {
  grader: string;
  cert: string;
  registryUrl: string;
  cardName: string | null;
  grade: string | null;
  populationNote: string | null;
  gradeDate: string | null;
  verified: boolean;
  /** gemrate | psa_public | web_snippet */
  dataProvider?: string | null;
};

export type LiquidAskHubLink = {
  platform: string;
  label: string;
  url: string;
  lane: "sold" | "active" | "reference";
};

export type LiquidAskDataCoverage = {
  researchTier: "free" | "pro";
  /** Sold comps pipeline operational (not browse-only). */
  ebaySoldReady: boolean;
  /** @deprecated Use ebaySoldReady */
  ebayConfigured: boolean;
  ebaySoldCount: number;
  ebayActiveCount: number;
  snippetCompCount: number;
  certLookupCount: number;
  hubsReady: boolean;
  geminiUsed: boolean;
  /** Pro: OpenRouter market model brief (Sonar, etc.) */
  proWebBriefUsed: boolean;
  /** Free: Gemini Google Search markdown brief */
  geminiBriefUsed: boolean;
  /** True when a scanned card could use eBay enrich but user is on free tier */
  proMarketSkipped: boolean;
};

/** Master catalog card art surfaced in PGT Ask UI + LLM context. */
export type LiquidAskCatalogCard = {
  catalogId: string | null;
  name: string;
  setName: string | null;
  number: string | null;
  imageUrl: string;
  role: "focus" | "session" | "reference";
  rawFmvUsd?: number | null;
};

/** Sold vs ask desk read for sentiment / buy-hold-sell framing. */
export type LiquidAskMarketPulse = {
  soldMedianUsd: number | null;
  activeLowUsd: number | null;
  soldCount: number;
  activeCount: number;
  sentiment: "bullish" | "neutral" | "bearish" | "thin";
  stanceHint: string;
};

export type LiquidAskResearch = {
  researchedAt: string;
  todayUtc: string;
  certLookups: LiquidAskCertLookup[];
  comps: LiquidAskComp[];
  sources: LiquidAskSource[];
  hubLinks: LiquidAskHubLink[];
  webNotes: string[];
  /** Web-grounded markdown brief (Gemini free or OpenRouter pro). */
  webBrief: string | null;
  sessionMarketAsOf: string | null;
  liveResearchUsed: boolean;
  dataCoverage: LiquidAskDataCoverage;
  /** Official catalog artwork when session match or catalog lookup succeeds. */
  catalogCards: LiquidAskCatalogCard[];
  /** Derived sold vs ask pulse for stance sections. */
  marketPulse: LiquidAskMarketPulse | null;
};
