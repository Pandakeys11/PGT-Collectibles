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
};
