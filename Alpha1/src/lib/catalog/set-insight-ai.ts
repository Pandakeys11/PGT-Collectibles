import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import {
  getGeminiApiKey,
  getGeminiTextModel,
  getGroqApiKey,
  getGroqCompoundModel,
  isGeminiServiceEnabled,
} from "@/lib/ai/env";
import {
  getSetInsightAiOrder,
  getSetInsightGroqMaxTokens,
  isAiRateLimitError,
  isAiResearchInCooldown,
  markAiResearchCooldown,
  shouldSkipSetInsightAiResearch,
} from "@/lib/ai/research-budget";
import { withTimeout } from "@/lib/async-timeout";
import type { GroqSetInsightRaw } from "@/lib/catalog/set-insight-groq";
import {
  parseGroqSetInsightJson,
  researchSetInsightWithGroq,
} from "@/lib/catalog/set-insight-groq";

export type SetInsightAiResult = { raw: GroqSetInsightRaw; model: string; provider: "groq" | "gemini" };

const SET_INSIGHT_GEMINI_SYSTEM = `You are PGT Set Intel — a sharp Pokémon TCG set market analyst with live web search.

Use Google Search to find current market color: chase cards, raw/graded price bands, sealed street prices, promos, momentum.
Return ONLY valid JSON (no markdown fences) matching this schema:
{
  "summary": "string (2-3 sentences)",
  "marketPulse": "string (one line)",
  "chaseNotes": "string",
  "topValueCards": [{ "name", "number", "rarity", "priceUsd", "priceLabel", "note" }],
  "momentumCards": [{ "name", "number", "momentumPct", "priceUsd", "note" }],
  "promoCards": [{ "name", "number", "priceUsd", "note" }],
  "sealedProducts": [{ "label", "priceUsd", "priceLabel", "note" }],
  "references": [{ "label", "url" }]
}
USD numbers when defensible; priceLabel: SOLD, ACTIVE, REFERENCE, or TCGPlayer market. Be concise and accurate.`;

function buildGeminiUserPrompt(input: {
  setId: string;
  setName: string;
  releaseDate: string | null;
  cardCount: number;
  catalogHints: string[];
  pricedSlots: number;
  todayUtc: string;
}): string {
  return `Today (UTC): ${input.todayUtc}

SET: ${input.setName}
SET ID: ${input.setId}
RELEASE: ${input.releaseDate ?? "unknown"}
CATALOG CARDS: ${input.cardCount}
TCGPLAYER SNAPSHOT ROWS: ${input.pricedSlots}

Catalog anchors:
${input.catalogHints.slice(0, 18).map((n) => `- ${n}`).join("\n") || "- (none)"}`;
}

async function researchSetInsightWithGemini(input: {
  setId: string;
  setName: string;
  releaseDate: string | null;
  cardCount: number;
  catalogHints: string[];
  pricedSlots: number;
}): Promise<SetInsightAiResult | null> {
  if (!isGeminiServiceEnabled() || isAiResearchInCooldown("gemini")) return null;

  const key = getGeminiApiKey();
  if (!key) return null;

  const modelName = getGeminiTextModel();
  const todayUtc = new Date().toISOString().slice(0, 10);

  try {
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({
      model: modelName,
      tools: [{ googleSearch: {} }] as never,
    });
    const result = await withTimeout(
      model.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${SET_INSIGHT_GEMINI_SYSTEM}\n\n${buildGeminiUserPrompt({ ...input, todayUtc })}`,
              },
            ],
          },
        ],
      }),
      75_000,
      "set insight gemini",
    );
    const text = result.response.text().trim();
    const raw = parseGroqSetInsightJson(text);
    if (!raw) return null;
    return { raw, model: modelName, provider: "gemini" };
  } catch (err) {
    if (isAiRateLimitError(err)) markAiResearchCooldown("gemini");
    return null;
  }
}

export { isSetInsightGroqConfigured } from "@/lib/catalog/set-insight-groq";

export function isSetInsightAiConfigured(): boolean {
  return Boolean(getGroqApiKey()) || isGeminiServiceEnabled();
}

/**
 * Web-research narrative for set insight — ordered providers with cooldown on 429.
 * Skips when catalog rollups are already strong (unless forceAi).
 */
export async function researchSetInsightWithAi(
  input: {
    setId: string;
    setName: string;
    releaseDate: string | null;
    cardCount: number;
    catalogHints: string[];
    pricedSlots: number;
    pricedPct: number;
    topValueCount: number;
    momentumCount: number;
  },
  options?: { forceAi?: boolean },
): Promise<SetInsightAiResult | null> {
  if (
    shouldSkipSetInsightAiResearch({
      pricedPct: input.pricedPct,
      topValueCount: input.topValueCount,
      momentumCount: input.momentumCount,
      forceAi: options?.forceAi,
    })
  ) {
    return null;
  }

  const order = getSetInsightAiOrder();
  const payload = {
    setId: input.setId,
    setName: input.setName,
    releaseDate: input.releaseDate,
    cardCount: input.cardCount,
    catalogHints: input.catalogHints,
    pricedSlots: input.pricedSlots,
  };

  for (const provider of order) {
    if (provider === "groq" && getGroqApiKey() && !isAiResearchInCooldown("groq")) {
      try {
        const groq = await researchSetInsightWithGroq(payload);
        if (groq) return { ...groq, provider: "groq" };
      } catch (err) {
        if (isAiRateLimitError(err)) markAiResearchCooldown("groq");
      }
      continue;
    }
    if (provider === "gemini") {
      const gemini = await researchSetInsightWithGemini(payload);
      if (gemini) return gemini;
    }
  }

  return null;
}
