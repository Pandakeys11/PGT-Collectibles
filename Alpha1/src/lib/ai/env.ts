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

export function getGeminiVisionModel(): string {
  return process.env.GEMINI_VISION_MODEL?.trim() || "gemini-2.5-flash";
}

export function getGeminiTextModel(): string {
  return process.env.GEMINI_TEXT_MODEL?.trim() || "gemini-2.5-flash";
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
  return process.env.GROQ_TEXT_MODEL?.trim() || "llama-3.1-8b-instant";
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
  return true;
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
  if (isGroqPrimaryOnly()) {
    return mergeSkipProviders(fromEnv, ["gemini", "openrouter", "openai", "xai"]);
  }
  return isFreeTierOnly()
    ? mergeSkipProviders(fromEnv, ["openai", "xai"])
    : fromEnv;
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

export function getOpenRouterTextModel(): string {
  return (
    process.env.OPENROUTER_TEXT_MODEL?.trim() ||
    "meta-llama/llama-3.1-8b-instruct:free"
  );
}

/** Search-capable model for Liquid Ask open-web research (Perplexity Sonar, etc.). */
export function getOpenRouterMarketModel(): string {
  const raw = process.env.OPENROUTER_MARKET_MODEL?.trim();
  if (raw && raw.includes("sonar") && raw.includes("llama-3.1")) {
    return "perplexity/sonar";
  }
  return raw || "perplexity/sonar";
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
  "openai",
  "xai",
  "groq",
  "gemini",
  "openrouter",
] as const;

export type TextProviderId = (typeof DEFAULT_TEXT_PROVIDER_ORDER)[number];

/** Comma-separated override, e.g. `groq,gemini` when OpenRouter has no credits. */
export function getTextProviderOrder(): string[] {
  if (isGroqPrimaryOnly() && getGroqApiKey()) return ["groq"];
  const raw = process.env.TEXT_PROVIDER_ORDER?.trim();
  if (!raw) return [...DEFAULT_TEXT_PROVIDER_ORDER];
  const ids = raw
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  return ids.length > 0 ? ids : [...DEFAULT_TEXT_PROVIDER_ORDER];
}

/** Skip providers with no credits or exhausted free tier, e.g. `openrouter,gemini,openai`. */
export function getTextSkipProviders(): string[] {
  const fromEnv = parseCommaList(process.env.TEXT_SKIP_PROVIDERS);
  if (isGroqPrimaryOnly()) {
    return mergeSkipProviders(fromEnv, ["gemini", "openrouter", "openai", "xai"]);
  }
  return isFreeTierOnly()
    ? mergeSkipProviders(fromEnv, ["openai", "xai"])
    : fromEnv;
}
