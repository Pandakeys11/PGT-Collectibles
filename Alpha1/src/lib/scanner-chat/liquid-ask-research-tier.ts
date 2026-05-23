/**
 * Liquid Ask research lanes — keep free vs paid API usage explicit.
 *
 * Free (no OpenRouter market / eBay API spend):
 * - Session scan comps, cert registry snippets, hub links
 * - DuckDuckGo snippet search
 * - Gemini Google Search grounding (brief + comp rows)
 *
 * Pro (paid / keyed marketplace APIs — enable when billing is funded):
 * - OpenRouter market model (e.g. Perplexity Sonar) open-web brief
 * - eBay sold harvest + full researchCardMarket enrich
 *
 * Cert registry (graded enrich / Ask) — see docs/CERT_REGISTRY_FALLBACKS.md:
 * GemRate → PSA API → Apify PSA → cert page → web (works without partner approval).
 */

export type LiquidAskResearchTier = "free" | "pro";

export const LIQUID_ASK_FREE_RESEARCH_STEPS = [
  "Session scan comps and desk brief context",
  "Cert registry lookup (PSA/CGC/BGS links from question or focus card)",
  "Platform hub links (eBay sold search, Card Ladder, ALT, etc.)",
  "Gemini Google Search grounding — markdown web brief",
  "DuckDuckGo snippet search for extra sources",
  "Gemini grounding — structured comp rows (fallback)",
] as const;

export const LIQUID_ASK_PRO_RESEARCH_STEPS = [
  "OpenRouter market model open-web brief (e.g. perplexity/sonar)",
  "eBay sold harvest (EBAY_FINDING_APP_ID / EBAY_CLIENT_ID)",
  "Full market enrich — keyed adapters (eBay, TCGPlayer, etc.)",
] as const;

/** Future env flags (optional) — wire when API credits are loaded. */
export function isLiquidAskProResearchEnabled(): boolean {
  if (process.env.LIQUID_ASK_PRO_RESEARCH === "0") return false;
  return true;
}

export function resolveLiquidAskResearchTier(proTier: boolean): LiquidAskResearchTier {
  if (!proTier) return "free";
  return isLiquidAskProResearchEnabled() ? "pro" : "free";
}
