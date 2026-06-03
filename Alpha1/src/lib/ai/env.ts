export function firstConfiguredEnv(...keys: string[]): string | null {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return null;
}

export function getOpenAIApiKey(): string | null {
  return firstConfiguredEnv("OPENAI_API_KEY");
}

export function getOpenAIVisionModel(): string {
  return process.env.OPENAI_VISION_MODEL?.trim() || "gpt-4o-mini";
}

export function getOpenAITextModel(): string {
  return process.env.OPENAI_TEXT_MODEL?.trim() || "gpt-4o-mini";
}

export function getGeminiApiKey(): string | null {
  return firstConfiguredEnv("GEMINI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY");
}

/** Set GEMINI_DISABLED=1 to skip Gemini for vision, text, market research, and Liquid Ask. */
export function isGeminiDisabled(): boolean {
  return process.env.GEMINI_DISABLED?.trim() === "1";
}

export function isGeminiServiceEnabled(): boolean {
  return Boolean(getGeminiApiKey()) && !isGeminiDisabled();
}

export function getGeminiVisionModel(): string {
  return process.env.GEMINI_VISION_MODEL?.trim() || "gemini-2.5-flash";
}

/** Optional second-pass model for "verify/fix" extraction on single images. */
export function getGeminiVisionVerifyModel(): string {
  return process.env.GEMINI_VISION_VERIFY_MODEL?.trim() || getGeminiVisionModel();
}

export function getGeminiTextModel(): string {
  return process.env.GEMINI_TEXT_MODEL?.trim() || "gemini-2.5-flash";
}

export function getGeminiEmbeddingModel(): string {
  return process.env.GEMINI_EMBEDDING_MODEL?.trim() || "gemini-embedding-001";
}

export function getGeminiEmbeddingDimensions(): number {
  const raw = process.env.GEMINI_EMBEDDING_DIMENSIONS?.trim();
  const n = raw ? Number(raw) : 768;
  if (!Number.isFinite(n) || n < 128 || n > 3072) return 768;
  return Math.floor(n);
}

/** Visual art match against cached catalog embeddings (requires Gemini). */
export function isArtMatchEnabled(): boolean {
  const raw = process.env.ART_MATCH_ENABLED?.trim();
  if (raw === "0" || raw?.toLowerCase() === "false") return false;
  return isGeminiServiceEnabled();
}

export function getGroqApiKey(): string | null {
  return firstConfiguredEnv("GROQ_API_KEY");
}

export function getGroqVisionModel(): string {
  return (
    process.env.GROQ_VISION_MODEL?.trim() ||
    "meta-llama/llama-4-scout-17b-16e-instruct"
  );
}

export function getGroqTextModel(): string {
  return process.env.GROQ_TEXT_MODEL?.trim() || "llama-3.3-70b-versatile";
}

/** Agentic web search + browser tools (Groq Compound GA). */
export function getGroqCompoundModel(): string {
  return (
    process.env.GROQ_COMPOUND_MODEL?.trim() ||
    process.env.GROQ_WEB_MODEL?.trim() ||
    "groq/compound"
  );
}

export function getOpenRouterApiKey(): string | null {
  return firstConfiguredEnv("OPENROUTER_API_KEY");
}

export function getOpenRouterBaseUrl(): string {
  return (
    process.env.OPENROUTER_BASE_URL?.trim() || "https://openrouter.ai/api/v1"
  );
}

export function getOpenRouterVisionModel(): string {
  return (
    process.env.OPENROUTER_VISION_MODEL?.trim() ||
    "nvidia/nemotron-nano-12b-v2-vl:free"
  );
}

/** xAI / Grok — accepts common env spellings (including `XAi_API_KEY`). */
export function getXaiApiKey(): string | null {
  return firstConfiguredEnv("XAI_API_KEY", "XAi_API_KEY", "GROK_API_KEY");
}

export function getXaiBaseUrl(): string {
  return process.env.XAI_BASE_URL?.trim() || "https://api.x.ai/v1";
}

export function getXaiVisionModel(): string {
  return (
    process.env.XAI_VISION_MODEL?.trim() ||
    process.env.GROK_VISION_MODEL?.trim() ||
    "grok-4-1-fast-non-reasoning"
  );
}

export function getXaiTextModel(): string {
  return (
    process.env.XAI_TEXT_MODEL?.trim() ||
    process.env.GROK_TEXT_MODEL?.trim() ||
    "grok-3-mini"
  );
}

const DEFAULT_VISION_PROVIDER_ORDER = [
  "groq",
  "gemini",
  "openrouter",
  "openai",
  "xai",
] as const;

/** Comma-separated override, e.g. `openrouter,groq` when Gemini/OpenAI are quota-limited. */
export function getVisionProviderOrder(): string[] {
  if (isGroqPrimaryOnly() && getGroqApiKey()) return ["groq"];
  const raw = process.env.VISION_PROVIDER_ORDER?.trim();
  if (!raw) return [...DEFAULT_VISION_PROVIDER_ORDER];
  const ids = raw
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  return ids.length > 0 ? ids : [...DEFAULT_VISION_PROVIDER_ORDER];
}

/** Binder grids need higher output token ceilings — prefer non-Groq providers first when available. */
export function getVisionProviderOrderForBinderGrid(): string[] {
  if (isGroqPrimaryOnly() && getGroqApiKey()) return ["groq"];
  const preferred = ["openrouter", "gemini", "openai", "xai", "groq"];
  const configured = preferred.filter((id) => {
    if (id === "groq") return Boolean(getGroqApiKey());
    if (id === "gemini") return isGeminiServiceEnabled();
    if (id === "openrouter") return Boolean(getOpenRouterApiKey());
    if (id === "openai") return Boolean(getOpenAIApiKey());
    if (id === "xai") return Boolean(getXaiApiKey());
    return false;
  });
  const skip = new Set(getVisionSkipProviders());
  const ordered = configured.filter((id) => !skip.has(id));
  return ordered.length > 0 ? ordered : getVisionProviderOrder();
}

function parseCommaList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

function mergeSkipProviders(...lists: string[][]): string[] {
  return [...new Set(lists.flat())];
}

/** When `FREE_TIER_ONLY=1`, skip paid APIs (OpenAI) even if not listed in *_SKIP_PROVIDERS. */
export function isFreeTierOnly(): boolean {
  return process.env.FREE_TIER_ONLY?.trim() === "1";
}

/**
 * Paid Groq testing: only Groq for vision + text (no OpenRouter/Gemini/OpenAI fallbacks).
 * Prevents double-billing when Groq fails and another provider runs the same job.
 */
export function isGroqPrimaryOnly(): boolean {
  return process.env.GROQ_PRIMARY_ONLY?.trim() === "1";
}

/** Post-scan session report auto-runs after enrich. Set SCAN_AUTO_REPORT=0 (or NEXT_PUBLIC_) to skip. */
export function isScanAutoReportEnabled(): boolean {
  const pub = process.env.NEXT_PUBLIC_SCAN_AUTO_REPORT?.trim();
  if (pub === "0") return false;
  if (pub === "1") return true;
  return process.env.SCAN_AUTO_REPORT?.trim() !== "0";
}

/** Gemini Google Search in Liquid Ask / scan-report research. Set 0 when testing Groq-only spend. */
export function isLiquidAskGeminiResearchEnabled(): boolean {
  if (process.env.LIQUID_ASK_GEMINI_RESEARCH === "0") return false;
  if (isGroqPrimaryOnly()) return false;
  return isGeminiServiceEnabled();
}

export function getGroqTextMaxTokensAsk(): number {
  return boundedTokenCount(process.env.GROQ_TEXT_MAX_TOKENS_ASK, 1_800, 2_400);
}

export function getGroqTextMaxTokensReport(): number {
  return boundedTokenCount(process.env.GROQ_TEXT_MAX_TOKENS_REPORT, 2_800, 4_096);
}

export function getLiquidAskMaxTokens(): number {
  return boundedTokenCount(process.env.LIQUID_ASK_MAX_TOKENS, 2_400, 3_200);
}

/** Comma-separated providers to skip (e.g. `gemini,openai` when out of quota). */
export function getVisionSkipProviders(): string[] {
  const fromEnv = parseCommaList(process.env.VISION_SKIP_PROVIDERS);
  const geminiOff = !isGeminiServiceEnabled() ? ["gemini"] : [];
  if (isGroqPrimaryOnly()) {
    return mergeSkipProviders(fromEnv, ["gemini", "openrouter", "openai", "xai"]);
  }
  return isFreeTierOnly()
    ? mergeSkipProviders(fromEnv, geminiOff, ["openai", "xai"])
    : mergeSkipProviders(fromEnv, geminiOff);
}

export function getVisionProviderTimeoutMs(): number {
  const raw = Number(process.env.VISION_PROVIDER_TIMEOUT_MS ?? 90_000);
  if (!Number.isFinite(raw)) return 90_000;
  return Math.min(Math.max(raw, 30_000), 180_000);
}

function boundedTokenCount(
  rawValue: string | number | undefined,
  fallback: number,
  max: number,
): number {
  const raw = Number(rawValue ?? fallback);
  if (!Number.isFinite(raw)) return fallback;
  return Math.min(Math.max(Math.floor(raw), 2048), max);
}

export function getVisionMaxOutputTokens(): number {
  return boundedTokenCount(
    process.env.VISION_MAX_OUTPUT_TOKENS,
    16_384,
    32_768,
  );
}

export function getVisionMaxOutputTokensForProvider(provider: string): number {
  const global = getVisionMaxOutputTokens();
  switch (provider) {
    case "groq":
      return boundedTokenCount(
        process.env.GROQ_VISION_MAX_OUTPUT_TOKENS,
        Math.min(global, 8192),
        8192,
      );
    case "gemini":
      return boundedTokenCount(
        process.env.GEMINI_VISION_MAX_OUTPUT_TOKENS,
        global,
        32_768,
      );
    case "openrouter":
      return boundedTokenCount(
        process.env.OPENROUTER_VISION_MAX_OUTPUT_TOKENS,
        global,
        32_768,
      );
    case "openai":
      return boundedTokenCount(
        process.env.OPENAI_VISION_MAX_OUTPUT_TOKENS,
        Math.min(global, 16_384),
        16_384,
      );
    case "xai":
      return boundedTokenCount(
        process.env.XAI_VISION_MAX_OUTPUT_TOKENS,
        Math.min(global, 16_384),
        16_384,
      );
    default:
      return global;
  }
}

const OPENROUTER_TEXT_MODEL_FALLBACKS_DEFAULT = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "qwen/qwen3-coder:free",
  "openrouter/free",
] as const;

export function getOpenRouterTextModel(): string {
  return (
    process.env.OPENROUTER_TEXT_MODEL?.trim() ||
    OPENROUTER_TEXT_MODEL_FALLBACKS_DEFAULT[0]
  );
}

/** Models to try in order when OpenRouter returns 404 / no endpoint. */
export function getOpenRouterTextModelCandidates(): string[] {
  const primary = getOpenRouterTextModel();
  const fromEnv = parseCommaList(process.env.OPENROUTER_TEXT_MODEL_FALLBACKS);
  const merged = [
    primary,
    ...fromEnv,
    ...OPENROUTER_TEXT_MODEL_FALLBACKS_DEFAULT,
  ];
  return [...new Set(merged.filter(Boolean))];
}

/** Search-capable model for Liquid Ask open-web research (Perplexity Sonar, etc.). */
export function getOpenRouterMarketModel(): string {
  const raw = process.env.OPENROUTER_MARKET_MODEL?.trim();
  if (raw && raw.includes("sonar") && raw.includes("llama-3.1")) {
    return "perplexity/sonar";
  }
  return raw || "perplexity/sonar";
}

/** Nightly set ingest: max cards queued per cron invocation (default 120). */
export function getMarketNightlyMaxCards(): number {
  const raw = Number(process.env.MARKET_INGEST_MAX_CARDS ?? 120);
  if (!Number.isFinite(raw)) return 120;
  return Math.min(Math.max(Math.floor(raw), 20), 250);
}

/** Parallel card ingests per batch (default 5). */
export function getMarketNightlyConcurrency(): number {
  const raw = Number(process.env.MARKET_INGEST_CONCURRENCY ?? 5);
  if (!Number.isFinite(raw)) return 5;
  return Math.min(Math.max(Math.floor(raw), 1), 8);
}

/** Wall-clock budget per cron run in ms (default 285000 ≈ 4m45s under Vercel 300s). */
export function getMarketNightlyTimeBudgetMs(): number {
  const raw = Number(process.env.MARKET_INGEST_TIME_BUDGET_MS ?? 285_000);
  if (!Number.isFinite(raw)) return 285_000;
  return Math.min(Math.max(Math.floor(raw), 60_000), 295_000);
}

/** Free AI order for nightly market JSON extraction: groq compound → gemini → openrouter. */
export function getMarketNightlyAiOrder(): Array<"groq" | "gemini" | "openrouter"> {
  const raw = process.env.MARKET_NIGHTLY_AI_ORDER?.trim();
  const defaultOrder: Array<"groq" | "gemini" | "openrouter"> = ["groq", "gemini", "openrouter"];
  let order: Array<"groq" | "gemini" | "openrouter">;
  if (!raw) {
    order = defaultOrder;
  } else {
    const parsed = raw
      .split(",")
      .map((p) => p.trim().toLowerCase())
      .filter(
        (p): p is "groq" | "gemini" | "openrouter" =>
          p === "groq" || p === "gemini" || p === "openrouter",
      );
    order = parsed.length > 0 ? parsed : defaultOrder;
  }
  if (!isGeminiServiceEnabled()) {
    order = order.filter((p) => p !== "gemini");
  }
  return order;
}

/** OpenRouter model for nightly market JSON (default free instruct; override with Sonar if you have credits). */
export function getMarketNightlyOpenRouterModel(): string {
  return (
    process.env.MARKET_NIGHTLY_OPENROUTER_MODEL?.trim() ||
    process.env.OPENROUTER_TEXT_MODEL?.trim() ||
    "meta-llama/llama-3.3-70b-instruct:free"
  );
}

/** Max tokens for Liquid Ask Groq Compound web brief (default 2000). */
export function getLiquidAskGroqBriefMaxTokens(): number {
  return boundedTokenCount(process.env.LIQUID_ASK_GROQ_BRIEF_MAX_TOKENS, 2_000, 3_200);
}

/** Skip Gemini/OpenRouter on nightly ingest when memory is fresh (default 10 days). */
export function getMarketNightlyMemoryFreshDays(): number {
  const raw = Number(process.env.MARKET_NIGHTLY_MEMORY_FRESH_DAYS ?? 10);
  if (!Number.isFinite(raw)) return 10;
  return Math.min(Math.max(Math.floor(raw), 3), 60);
}

export function getTextModel(): string {
  return (
    process.env.OPENROUTER_TEXT_MODEL?.trim() ||
    process.env.OPENAI_TEXT_MODEL?.trim() ||
    process.env.GEMINI_TEXT_MODEL?.trim() ||
    process.env.GROQ_TEXT_MODEL?.trim() ||
    "gpt-4o-mini"
  );
}

const DEFAULT_TEXT_PROVIDER_ORDER = [
  "openrouter",
  "groq",
  "gemini",
  "openai",
  "xai",
] as const;

export type TextProviderId = (typeof DEFAULT_TEXT_PROVIDER_ORDER)[number];

/** Skip providers with no credits or exhausted free tier, e.g. `openrouter,gemini,openai`. */
export function getTextSkipProviders(): string[] {
  const fromEnv = parseCommaList(process.env.TEXT_SKIP_PROVIDERS);
  const geminiOff = !isGeminiServiceEnabled() ? ["gemini"] : [];
  if (isGroqPrimaryOnly()) {
    return mergeSkipProviders(fromEnv, ["gemini", "openrouter", "openai", "xai"]);
  }
  if (isFreeTierOnly()) {
    return mergeSkipProviders(fromEnv, geminiOff, ["openai", "xai"]);
  }
  return mergeSkipProviders(fromEnv, geminiOff);
}

/** Prefer OpenRouter when configured and not in skip list (works on free models). */
export function getTextProviderOrder(): string[] {
  if (isGroqPrimaryOnly() && getGroqApiKey()) return ["groq"];
  const raw = process.env.TEXT_PROVIDER_ORDER?.trim();
  let order =
    raw
      ?.split(",")
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean) ?? [...DEFAULT_TEXT_PROVIDER_ORDER];
  if (order.length === 0) order = [...DEFAULT_TEXT_PROVIDER_ORDER];
  const skip = new Set(getTextSkipProviders());
  if (getOpenRouterApiKey() && !skip.has("openrouter") && !raw?.trim()) {
    order = ["openrouter", ...order.filter((id) => id !== "openrouter")];
  }
  return order;
}
