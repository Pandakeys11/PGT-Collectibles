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

const WEB_BRIEF_SYSTEM = `You are PGT Liquid Vault **Open Research** — answer collectible market questions using current public web knowledge (use search/retrieval when available).

Hard requirements:
1. **Answer the question directly** in the first paragraph (name cards, editions, grades when relevant). Do NOT tell the user to upload scans, use Liquid Scan steps, or "provide more information" unless the question is truly impossible to narrow (e.g. no franchise named at all).
2. Never say you lack a "research pack" — this request is the research pass.
3. Use ranges and "reported as of {date}" language for prices; cite source types (eBay sold, auction, PriceCharting, PSA pop reports) when known.
4. Separate **1st Edition / Shadowless / Unlimited** for vintage Pokémon when discussing Base Set era.
5. End with one short disclaimer line: web-sourced indicative intel — verify before transacting.

Format: markdown with a bold lead sentence, then 3–6 evidence bullets, optional short "Also consider" for runners-up.`;

function buildUserPrompt(message: string, todayUtc: string): string {
  return `Today's date (UTC): ${todayUtc}

User question:
${message.trim()}

Produce a direct, web-grounded answer. If the question is about the highest-value card in a set (e.g. Pokémon Base Set), name the top card(s) by edition (1st Ed vs Unlimited), typical grade buckets (PSA 10 vs raw), and approximate recent sale ranges with source cues.`;
}

/** Free tier: Gemini + Google Search grounding (uses GEMINI_API_KEY free quota). */
export function isLiquidAskFreeWebBriefConfigured(): boolean {
  return Boolean(getGeminiApiKey());
}

export async function runLiquidAskFreeWebBrief(
  message: string,
  todayUtc: string,
): Promise<{ markdown: string; model: string } | null> {
  const key = getGeminiApiKey();
  if (!key) return null;

  const modelName = getGeminiTextModel();
  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({
    model: modelName,
    tools: [{ googleSearch: {} }] as never,
  });

  try {
    const result = await withTimeout(
      model.generateContent({
        contents: [
          {
            role: "user",
            parts: [{ text: `${WEB_BRIEF_SYSTEM}\n\n${buildUserPrompt(message, todayUtc)}` }],
          },
        ],
      }),
      75_000,
      "liquid ask gemini web brief",
    );
    const markdown = result.response.text().trim();
    if (!markdown) return null;
    return { markdown, model: modelName };
  } catch {
    return null;
  }
}

/** Pro tier: OpenRouter market model (Perplexity Sonar, etc.) — paid per request. */
export function isLiquidAskProWebBriefConfigured(): boolean {
  return Boolean(getOpenRouterApiKey());
}

/** @deprecated Use isLiquidAskProWebBriefConfigured */
export function isLiquidAskWebBriefConfigured(): boolean {
  return isLiquidAskProWebBriefConfigured();
}

export async function runLiquidAskProWebBrief(
  message: string,
  todayUtc: string,
): Promise<{ markdown: string; model: string } | null> {
  const key = getOpenRouterApiKey();
  if (!key) return null;

  const client = new OpenAI({ apiKey: key, baseURL: getOpenRouterBaseUrl() });
  const model = getOpenRouterMarketModel();

  try {
    const response = await withTimeout(
      client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: WEB_BRIEF_SYSTEM },
          { role: "user", content: buildUserPrompt(message, todayUtc) },
        ],
        temperature: 0.25,
        max_tokens: 2_400,
      }),
      90_000,
      "liquid ask pro web brief",
    );
    const markdown = response.choices[0]?.message?.content?.trim() ?? "";
    if (!markdown) return null;
    return { markdown, model };
  } catch {
    return null;
  }
}

/** @deprecated Use runLiquidAskProWebBrief — pro tier only */
export async function runLiquidAskWebBrief(
  message: string,
  todayUtc: string,
): Promise<{ markdown: string; model: string } | null> {
  return runLiquidAskProWebBrief(message, todayUtc);
}
