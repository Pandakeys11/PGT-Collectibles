import type { UserPlan } from "@/lib/auth/plans";
import { isProTierPlan } from "@/lib/auth/plans";

export type PlanTier = "free" | "pro";

export function planTier(plan: UserPlan): PlanTier {
  return isProTierPlan(plan) ? "pro" : "free";
}

export const FREE_TIER_FEATURES = [
  "Full scanner, catalog, and export workflow",
  "Free vision providers (Groq + OpenRouter)",
  "Liquid Ask: Gemini web brief + DuckDuckGo + session comps",
  "15 scan credits per month (resets on the 1st UTC)",
  "First 200 signups: +50 bonus starter scans (auto-granted)",
  "1 scan credit per photo or precision crop",
] as const;

export const PRO_TIER_FEATURES = [
  "Premium vision models (Gemini, OpenAI when enabled)",
  "Liquid Ask: OpenRouter market brief + eBay sold enrich",
  "Higher daily and monthly scan limits",
  "Priority extraction queue",
  "Deeper AI narration and enrichment",
  "Bonus scan packs stack on your balance",
] as const;

export const SCAN_CREDIT_TIPS = [
  "Each uploaded image or crop sent to vision costs 1 scan credit.",
  "Catalog browsing, edits, saves, and exports are always free.",
  "Free tier allowance resets monthly on the 1st UTC. Pro plans also track a daily cap.",
  "Early adopter promo: first 200 accounts get +50 bonus scans at signup (automatic).",
  "Buy scan packs anytime — they never expire and apply after plan limits.",
] as const;
