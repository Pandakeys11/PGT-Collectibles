import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import {
  getGeminiApiKey,
  getGeminiTextModel,
  getOpenRouterApiKey,
  getOpenRouterBaseUrl,
  getOpenRouterMarketModel,
} from "@/lib/ai/env";
import { withTimeout } from "@/lib/async-timeout";
import {
  isLiquidAskFreeWebBriefConfigured,
  isLiquidAskProWebBriefConfigured,
} from "@/lib/scanner-chat/liquid-ask-web-brief";
import type { ExtractedCard } from "@/lib/scan/schemas";

const PREMIUM_GRADE_BRIEF_SYSTEM = `You are PGT Liquid Vault market research — answer with **current web knowledge** (use Google Search when available).

The user wants a **premium graded comp sheet** for one Pokémon/card identity. Answer in plain, scannable prose (short paragraphs + bullets). Do NOT ask them to upload photos or use Liquid Scan.

Required sections (use these exact headings as bold lines):
**PSA 10** — last sold(s) with $ and date if known; typical recent sold range; current live listing / ask range
**BGS Black Label** — same; say if market is thin or no recent public sales
**CGC 10 / Pristine** — same; distinguish CGC Pristine 10 vs CGC 9.5 / Gem Mint 10

Rules:
- Lead with the card name, set, number, year, and holo/rarity in one sentence.
- Separate **sold** vs **listed/asking** for each tier.
- For vintage Pokémon Base era, note **1st Edition vs Unlimited** when it materially affects price.
- Use "as of {today}" language; cite source types (eBay sold, PWCC, Goldin, Card Ladder) — no invented URLs.
- If data is sparse for a tier, say so honestly.
- End with one line: indicative web research — verify before buying or selling.`;

export function buildPremiumGradesAskMessage(
  card: Pick<ExtractedCard, "name" | "set" | "number" | "year" | "rarity" | "printStamps">,
): string {
  const identity = [
    card.name?.trim(),
    card.set?.trim(),
    card.number?.trim(),
    card.year?.trim() ? `(${card.year})` : null,
    card.rarity?.trim(),
    card.printStamps?.trim(),
  ]
    .filter(Boolean)
    .join(" · ");

  return `Card: ${identity || "unknown"}

What are the recent sales and current listed prices for this exact card in these grades?
- PSA 10 (sold and live asks)
- BGS Black Label (sold and live asks)
- CGC 10 / CGC Pristine 10 (sold and live asks; not CGC 9.5)

Prefer sales from the last 60–90 days when available. Give USD amounts and approximate dates.`;
}

export type PremiumGradeBriefResult = {
  markdown: string;
  model: string;
  provider: "gemini" | "openrouter";
  todayUtc: string;
  configured: boolean;
};

export async function runPremiumGradeWebBrief(
  card: Pick<ExtractedCard, "name" | "set" | "number" | "year" | "rarity" | "printStamps">,
  options?: { proTier?: boolean },
): Promise<PremiumGradeBriefResult> {
  const todayUtc = new Date().toISOString().slice(0, 10);
  const userMessage = buildPremiumGradesAskMessage(card);
  const fullPrompt = `${PREMIUM_GRADE_BRIEF_SYSTEM}\n\nToday's date (UTC): ${todayUtc}\n\n${userMessage}`;

  const configured =
    isLiquidAskFreeWebBriefConfigured() || isLiquidAskProWebBriefConfigured();

  if (!configured) {
    return {
      markdown: "",
      model: "",
      provider: "gemini",
      todayUtc,
      configured: false,
    };
  }

  if (options?.proTier && isLiquidAskProWebBriefConfigured()) {
    const key = getOpenRouterApiKey();
    if (key) {
      try {
        const client = new OpenAI({ apiKey: key, baseURL: getOpenRouterBaseUrl() });
        const model = getOpenRouterMarketModel();
        const response = await withTimeout(
          client.chat.completions.create({
            model,
            messages: [
              { role: "system", content: PREMIUM_GRADE_BRIEF_SYSTEM },
              {
                role: "user",
                content: `Today's date (UTC): ${todayUtc}\n\n${userMessage}`,
              },
            ],
            temperature: 0.25,
            max_tokens: 2_000,
          }),
          85_000,
          "premium grade pro brief",
        );
        const markdown = response.choices[0]?.message?.content?.trim() ?? "";
        if (markdown) {
          return {
            markdown,
            model,
            provider: "openrouter",
            todayUtc,
            configured: true,
          };
        }
      } catch {
        /* fall through */
      }
    }
  }

  const geminiKey = getGeminiApiKey();
  if (geminiKey) {
    try {
      const modelName = getGeminiTextModel();
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({
        model: modelName,
        tools: [{ googleSearch: {} }] as never,
      });
      const result = await withTimeout(
        model.generateContent({
          contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
        }),
        75_000,
        "premium grade gemini brief",
      );
      const markdown = result.response.text().trim();
      if (markdown) {
        return {
          markdown,
          model: modelName,
          provider: "gemini",
          todayUtc,
          configured: true,
        };
      }
    } catch {
      /* fall through */
    }
  }

  return {
    markdown: "",
    model: "",
    provider: "gemini",
    todayUtc,
    configured: true,
  };
}
