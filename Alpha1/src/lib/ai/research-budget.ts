/**
 * Shared rate-limit / cooldown + ordering for web-research LLM calls
 * (set insight, Liquid Ask briefs, market JSON extraction).
 */

export type AiResearchProvider = "groq" | "gemini" | "openrouter";

const cooldownUntil = new Map<AiResearchProvider, number>();

export function isAiRateLimitError(err: unknown): boolean {
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === "object" && err && "message" in err
        ? String((err as { message?: unknown }).message)
        : String(err ?? "");
  return /429|503|502|rate limit|quota|high demand|temporarily unavailable|overloaded|too many requests|retry in/i.test(
    msg,
  );
}

export function getAiResearchCooldownMs(): number {
  const raw = Number(process.env.AI_RESEARCH_COOLDOWN_MIN ?? 15);
  if (!Number.isFinite(raw)) return 15 * 60 * 1000;
  return Math.min(Math.max(Math.floor(raw), 5), 120) * 60 * 1000;
}

export function markAiResearchCooldown(
  provider: AiResearchProvider,
  ms: number = getAiResearchCooldownMs(),
): void {
  cooldownUntil.set(provider, Date.now() + ms);
}

export function isAiResearchInCooldown(provider: AiResearchProvider): boolean {
  const until = cooldownUntil.get(provider);
  if (!until) return false;
  if (Date.now() >= until) {
    cooldownUntil.delete(provider);
    return false;
  }
  return true;
}

export function clearAiResearchCooldowns(): void {
  cooldownUntil.clear();
}

export function getAiResearchCooldownRemainingMs(provider: AiResearchProvider): number {
  const until = cooldownUntil.get(provider);
  if (!until) return 0;
  return Math.max(0, until - Date.now());
}

function parseProviderOrder(
  raw: string | undefined,
  allowed: readonly AiResearchProvider[],
  fallback: readonly AiResearchProvider[],
): AiResearchProvider[] {
  const list = raw
    ?.split(",")
    .map((p) => p.trim().toLowerCase())
    .filter((p): p is AiResearchProvider =>
      (allowed as readonly string[]).includes(p),
    );
  return list?.length ? [...list] : [...fallback];
}

/** Liquid Ask open-web brief: default Gemini (free search) before Groq Compound. */
export function getLiquidAskWebBriefOrder(): AiResearchProvider[] {
  return parseProviderOrder(
    process.env.LIQUID_ASK_WEB_BRIEF_ORDER,
    ["gemini", "groq", "openrouter"],
    ["gemini", "groq"],
  );
}

/** Scan-time market JSON: one provider at a time until enough sold rows. */
export function getMarketScanAiOrder(): AiResearchProvider[] {
  return parseProviderOrder(
    process.env.MARKET_SCAN_AI_ORDER,
    ["gemini", "groq", "openrouter"],
    ["gemini", "groq"],
  );
}

/** Set insight narrative: Groq Compound first, then Gemini search. */
export function getSetInsightAiOrder(): AiResearchProvider[] {
  return parseProviderOrder(
    process.env.SET_INSIGHT_AI_ORDER,
    ["groq", "gemini"],
    ["groq", "gemini"],
  );
}

export function getSetInsightCacheHours(): number {
  const raw = Number(process.env.SET_INSIGHT_CACHE_HOURS ?? 24);
  if (!Number.isFinite(raw)) return 24;
  return Math.min(Math.max(Math.floor(raw), 1), 168);
}

export function getSetInsightCacheTtlMs(): number {
  return getSetInsightCacheHours() * 60 * 60 * 1000;
}

/** Skip paid web-research when catalog already has strong TCGPlayer rollups. */
export function getSetInsightAiSkipMinPricedPct(): number {
  const raw = Number(process.env.SET_INSIGHT_AI_SKIP_PRICED_PCT ?? 80);
  if (!Number.isFinite(raw)) return 80;
  return Math.min(Math.max(Math.floor(raw), 0), 100);
}

export function getSetInsightGroqMaxTokens(): number {
  const raw = Number(process.env.SET_INSIGHT_GROQ_MAX_TOKENS ?? 2_000);
  if (!Number.isFinite(raw)) return 2_000;
  return Math.min(Math.max(Math.floor(raw), 800), 4_096);
}

export function shouldSkipSetInsightAiResearch(args: {
  pricedPct: number;
  topValueCount: number;
  momentumCount: number;
  forceAi?: boolean;
}): boolean {
  if (args.forceAi) return false;
  if (process.env.SET_INSIGHT_FORCE_AI === "1") return false;
  const minPct = getSetInsightAiSkipMinPricedPct();
  if (minPct <= 0) return false;
  return (
    args.pricedPct >= minPct &&
    args.topValueCount >= 5 &&
    args.momentumCount >= 1
  );
}
