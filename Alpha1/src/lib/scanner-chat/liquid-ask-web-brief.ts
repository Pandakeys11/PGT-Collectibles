import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import {
  getGeminiApiKey,
  getGeminiTextModel,
  getGroqApiKey,
  getGroqCompoundModel,
  getOpenRouterApiKey,
  getOpenRouterBaseUrl,
  getOpenRouterMarketModel,
} from "@/lib/ai/env";
import { withTimeout } from "@/lib/async-timeout";
import { buildMarketMasterWebBriefRules } from "@/lib/scanner-chat/market-master-guard-rails";

const WEB_BRIEF_SYSTEM = buildMarketMasterWebBriefRules();

function buildUserPrompt(message: string, todayUtc: string): string {
  return `Today's date (UTC): ${todayUtc}

User question:
${message.trim()}

Produce a direct, web-grounded answer. If the question is about the highest-value card in a set (e.g. Pokémon Base Set), name the top card(s) by edition (1st Ed vs Unlimited), typical grade buckets (PSA 10 vs raw), and approximate recent sale ranges with source cues. Label each price as SOLD, ACTIVE (ask), or REFERENCE.`;
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

/** Groq Compound — built-in web search (preferred when GROQ_API_KEY is set). */
export function isLiquidAskGroqWebBriefConfigured(): boolean {
  return Boolean(getGroqApiKey());
}

export async function runLiquidAskGroqWebBrief(
  message: string,
  todayUtc: string,
): Promise<{ markdown: string; model: string } | null> {
  const key = getGroqApiKey();
  if (!key) return null;

  const client = new OpenAI({ apiKey: key, baseURL: "https://api.groq.com/openai/v1" });
  const model = getGroqCompoundModel();

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
      "liquid ask groq web brief",
    );
    const markdown = response.choices[0]?.message?.content?.trim() ?? "";
    if (!markdown) return null;
    return { markdown, model };
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
