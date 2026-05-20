import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import {
  getGeminiApiKey,
  getGeminiTextModel,
  getGroqApiKey,
  getGroqTextModel,
  getOpenAIApiKey,
  getOpenAITextModel,
  getOpenRouterApiKey,
  getOpenRouterBaseUrl,
  getOpenRouterTextModel,
  getTextProviderOrder,
  getTextSkipProviders,
  type TextProviderId,
} from "@/lib/ai/env";

export type TextCompletionResult =
  | { ok: true; text: string; provider: string }
  | { ok: false; error: string; cause?: string };

type TextProvider = {
  name: string;
  run: () => Promise<string>;
};

async function runOpenAiCompatible(
  client: OpenAI,
  model: string,
  system: string,
  user: string,
  jsonObject?: boolean,
): Promise<string> {
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.2,
    ...(jsonObject ? { response_format: { type: "json_object" as const } } : {}),
  });
  const text = response.choices[0]?.message?.content?.trim() ?? "";
  if (!text) throw new Error("Empty model response");
  return text;
}

async function runGeminiText(system: string, user: string, jsonObject?: boolean): Promise<string> {
  const genAI = new GoogleGenerativeAI(getGeminiApiKey()!);
  const model = genAI.getGenerativeModel({
    model: getGeminiTextModel(),
    generationConfig: {
      temperature: 0.2,
      ...(jsonObject ? { responseMimeType: "application/json" } : {}),
    },
  });
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: `${system}\n\n${user}` }] }],
  });
  const text = result.response.text().trim();
  if (!text) throw new Error("Empty model response");
  return text;
}

function createProviderRunners(
  system: string,
  user: string,
  jsonObject?: boolean,
): Partial<Record<TextProviderId, TextProvider>> {
  const runners: Partial<Record<TextProviderId, TextProvider>> = {};

  const openRouterKey = getOpenRouterApiKey();
  if (openRouterKey) {
    runners.openrouter = {
      name: "openrouter",
      run: () =>
        runOpenAiCompatible(
          new OpenAI({ apiKey: openRouterKey, baseURL: getOpenRouterBaseUrl() }),
          getOpenRouterTextModel(),
          system,
          user,
          jsonObject,
        ),
    };
  }

  const groqKey = getGroqApiKey();
  if (groqKey) {
    runners.groq = {
      name: "groq",
      run: () =>
        runOpenAiCompatible(
          new OpenAI({ apiKey: groqKey, baseURL: "https://api.groq.com/openai/v1" }),
          getGroqTextModel(),
          system,
          user,
          jsonObject,
        ),
    };
  }

  const geminiKey = getGeminiApiKey();
  if (geminiKey) {
    runners.gemini = {
      name: "gemini",
      run: () => runGeminiText(system, user, jsonObject),
    };
  }

  const openAiKey = getOpenAIApiKey();
  if (openAiKey) {
    runners.openai = {
      name: "openai",
      run: () =>
        runOpenAiCompatible(
          new OpenAI({ apiKey: openAiKey }),
          getOpenAITextModel(),
          system,
          user,
          jsonObject,
        ),
    };
  }

  return runners;
}

function buildTextProviders(system: string, user: string, jsonObject?: boolean): TextProvider[] {
  const skip = new Set(getTextSkipProviders());
  const order = getTextProviderOrder();
  const runners = createProviderRunners(system, user, jsonObject);
  const providers: TextProvider[] = [];

  for (const id of order) {
    if (skip.has(id)) continue;
    const runner = runners[id as TextProviderId];
    if (runner) providers.push(runner);
  }

  for (const [id, runner] of Object.entries(runners)) {
    if (order.includes(id) || skip.has(id)) continue;
    providers.push(runner);
  }

  return providers;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientLlmFailure(message: string): boolean {
  return /429|503|502|rate limit|quota|high demand|temporarily|overloaded|timeout|retry in/i.test(
    message,
  );
}

function isBillingOrCreditsFailure(message: string): boolean {
  return /402|Insufficient credits|never purchased credits|exceeded your current quota|billing details/i.test(
    message,
  );
}

function isRequestTooLarge(message: string): boolean {
  return /413|too large|Request too large|tokens per minute.*Requested/i.test(message);
}

export async function completePlainText(
  system: string,
  user: string,
  options?: { json?: boolean },
): Promise<TextCompletionResult> {
  const providers = buildTextProviders(system, user, options?.json);
  if (providers.length === 0) {
    return {
      ok: false,
      error:
        "No text LLM available. Set GROQ_API_KEY and/or OPENROUTER_API_KEY (free models), optionally GEMINI_API_KEY. Check FREE_TIER_ONLY, TEXT_SKIP_PROVIDERS, and TEXT_PROVIDER_ORDER.",
    };
  }

  const failures: string[] = [];
  for (const provider of providers) {
    let lastMessage = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const text = await provider.run();
        return { ok: true, text, provider: provider.name };
      } catch (err) {
        lastMessage = err instanceof Error ? err.message : String(err);
        if (isBillingOrCreditsFailure(lastMessage) || isRequestTooLarge(lastMessage)) {
          break;
        }
        if (attempt === 0 && isTransientLlmFailure(lastMessage)) {
          await sleep(2600);
          continue;
        }
        break;
      }
    }
    failures.push(`${provider.name}: ${lastMessage}`);
  }

  return {
    ok: false,
    error: "All text providers failed",
    cause: failures.join(" | "),
  };
}
