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
  getXaiApiKey,
  getXaiBaseUrl,
  getXaiTextModel,
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
  maxTokens = 900,
): Promise<string> {
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.2,
    max_tokens: jsonObject ? Math.min(maxTokens, 1200) : maxTokens,
    ...(jsonObject ? { response_format: { type: "json_object" as const } } : {}),
  });
  const text = response.choices[0]?.message?.content?.trim() ?? "";
  if (!text) throw new Error("Empty model response");
  return text;
}

async function runGeminiText(
  system: string,
  user: string,
  jsonObject?: boolean,
  maxTokens = 900,
): Promise<string> {
  const genAI = new GoogleGenerativeAI(getGeminiApiKey()!);
  const model = genAI.getGenerativeModel({
    model: getGeminiTextModel(),
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: jsonObject ? Math.min(maxTokens, 1200) : maxTokens,
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
  maxTokens = 900,
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
          maxTokens,
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
          maxTokens,
        ),
    };
  }

  const geminiKey = getGeminiApiKey();
  if (geminiKey) {
    runners.gemini = {
      name: "gemini",
      run: () => runGeminiText(system, user, jsonObject, maxTokens),
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
          maxTokens,
        ),
    };
  }

  const xaiKey = getXaiApiKey();
  if (xaiKey) {
    runners.xai = {
      name: "xai",
      run: () =>
        runOpenAiCompatible(
          new OpenAI({ apiKey: xaiKey, baseURL: getXaiBaseUrl() }),
          getXaiTextModel(),
          system,
          user,
          jsonObject,
          maxTokens,
        ),
    };
  }

  return runners;
}

function buildTextProviders(
  system: string,
  user: string,
  jsonObject?: boolean,
  maxTokens = 900,
): TextProvider[] {
  const skip = new Set(getTextSkipProviders());
  const order = getTextProviderOrder();
  const runners = createProviderRunners(system, user, jsonObject, maxTokens);
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

export type TextStreamEvent =
  | { type: "chunk"; text: string }
  | { type: "done"; provider: string }
  | { type: "error"; message: string; cause?: string };

async function streamOpenAiCompatible(
  client: OpenAI,
  model: string,
  system: string,
  user: string,
  maxTokens: number,
  providerLabel: string,
): Promise<AsyncGenerator<TextStreamEvent>> {
  async function* gen() {
    const response = await client.chat.completions.create({
      model,
      stream: true,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.2,
      max_tokens: maxTokens,
    });
    for await (const chunk of response) {
      const text = chunk.choices[0]?.delta?.content;
      if (text) yield { type: "chunk" as const, text };
    }
    yield { type: "done" as const, provider: providerLabel };
  }
  return gen();
}

async function streamGeminiText(
  system: string,
  user: string,
  maxTokens: number,
): Promise<AsyncGenerator<TextStreamEvent>> {
  async function* gen() {
    const genAI = new GoogleGenerativeAI(getGeminiApiKey()!);
    const model = genAI.getGenerativeModel({
      model: getGeminiTextModel(),
      generationConfig: { temperature: 0.2, maxOutputTokens: maxTokens },
    });
    const result = await model.generateContentStream({
      contents: [{ role: "user", parts: [{ text: `${system}\n\n${user}` }] }],
    });
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) yield { type: "chunk" as const, text };
    }
    yield { type: "done" as const, provider: "gemini" };
  }
  return gen();
}

/** Stream tokens from the first available text provider (OpenAI-compatible + Gemini). */
export async function streamPlainText(
  system: string,
  user: string,
  options?: { maxTokens?: number },
): Promise<AsyncGenerator<TextStreamEvent>> {
  const maxTokens = options?.maxTokens ?? 900;
  const providers = buildTextProviders(system, user, false, maxTokens);
  if (providers.length === 0) {
    async function* empty() {
      yield {
        type: "error" as const,
        message:
          "No text LLM available. Set GROQ_API_KEY and/or OPENROUTER_API_KEY (free models), optionally GEMINI_API_KEY.",
      };
    }
    return empty();
  }

  const failures: string[] = [];

  async function* chain() {
    for (const provider of providers) {
      try {
        let inner: AsyncGenerator<TextStreamEvent>;
        if (provider.name === "gemini") {
          inner = await streamGeminiText(system, user, maxTokens);
        } else {
          const openRouterKey = getOpenRouterApiKey();
          const groqKey = getGroqApiKey();
          const openAiKey = getOpenAIApiKey();
          const xaiKey = getXaiApiKey();
          let client: OpenAI | null = null;
          let model = "";
          if (provider.name === "openrouter" && openRouterKey) {
            client = new OpenAI({ apiKey: openRouterKey, baseURL: getOpenRouterBaseUrl() });
            model = getOpenRouterTextModel();
          } else if (provider.name === "groq" && groqKey) {
            client = new OpenAI({ apiKey: groqKey, baseURL: "https://api.groq.com/openai/v1" });
            model = getGroqTextModel();
          } else if (provider.name === "openai" && openAiKey) {
            client = new OpenAI({ apiKey: openAiKey });
            model = getOpenAITextModel();
          } else if (provider.name === "xai" && xaiKey) {
            client = new OpenAI({ apiKey: xaiKey, baseURL: getXaiBaseUrl() });
            model = getXaiTextModel();
          }
          if (!client) continue;
          inner = await streamOpenAiCompatible(
            client,
            model,
            system,
            user,
            maxTokens,
            provider.name,
          );
        }

        let providerName = provider.name;
        for await (const event of inner) {
          if (event.type === "done") {
            providerName = event.provider || provider.name;
            yield { type: "done" as const, provider: providerName };
            return;
          }
          if (event.type === "error") {
            failures.push(`${provider.name}: ${event.message}`);
            break;
          }
          if (event.type === "chunk") yield event;
        }
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        failures.push(`${provider.name}: ${msg}`);
        if (isBillingOrCreditsFailure(msg) || isRequestTooLarge(msg)) break;
      }
    }
    yield {
      type: "error" as const,
      message: "All text providers failed",
      cause: failures.join(" | "),
    };
  }

  return chain();
}

export async function completePlainText(
  system: string,
  user: string,
  options?: { json?: boolean; maxTokens?: number },
): Promise<TextCompletionResult> {
  const maxTokens = options?.maxTokens ?? 900;
  const providers = buildTextProviders(system, user, options?.json, maxTokens);
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
