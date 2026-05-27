import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import {
  getGeminiApiKey,
  getGeminiVisionModel,
  getGeminiVisionVerifyModel,
  getGroqApiKey,
  getGroqVisionModel,
  getOpenAIApiKey,
  getOpenAIVisionModel,
  getOpenRouterApiKey,
  getOpenRouterBaseUrl,
  getOpenRouterVisionModel,
  getXaiApiKey,
  getXaiBaseUrl,
  getXaiVisionModel,
  getVisionMaxOutputTokensForProvider,
  getVisionProviderOrder,
  getVisionProviderOrderForBinderGrid,
  getVisionSkipProviders,
} from "@/lib/ai/env";
import {
  parseVisionCardsFromText,
  type ParseVisionCardsResult,
} from "@/lib/scan/parse-vision-response";

export type VisionProviderId =
  | "groq"
  | "gemini"
  | "openrouter"
  | "openai"
  | "xai";

export type VisionRunResult = ParseVisionCardsResult & {
  provider: VisionProviderId;
  finishReason?: string | null;
  compactRetry?: boolean;
};

const providerCooldownUntil = new Map<VisionProviderId, number>();

function imageDataUrl(base64: string, mimeType: string): string {
  return `data:${mimeType};base64,${base64}`;
}

export function isQuotaOrRateLimitError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /429|quota|rate.?limit|too many requests|resource_exhausted/i.test(
    message,
  );
}

export function isJsonParseFailure(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /json|unterminated|unexpected token|could not parse vision/i.test(
    message,
  );
}

function parseRetryAfterMs(err: unknown): number | null {
  const message = err instanceof Error ? err.message : String(err);
  const sec = message.match(/retry in (\d+(?:\.\d+)?)\s*s/i)?.[1];
  if (sec) {
    const ms = Math.ceil(Number(sec) * 1000);
    if (Number.isFinite(ms) && ms > 0) return Math.min(ms, 3_600_000);
  }
  return null;
}

export function markProviderCooldown(id: VisionProviderId, ms: number): void {
  providerCooldownUntil.set(id, Date.now() + ms);
}

export function clearProviderCooldowns(): void {
  providerCooldownUntil.clear();
}

export function isProviderInCooldown(id: VisionProviderId): boolean {
  const until = providerCooldownUntil.get(id);
  if (!until) return false;
  if (Date.now() >= until) {
    providerCooldownUntil.delete(id);
    return false;
  }
  return true;
}

export function getProviderCooldownRemainingMs(id: VisionProviderId): number {
  const until = providerCooldownUntil.get(id);
  if (!until) return 0;
  return Math.max(0, until - Date.now());
}

function openAiCompletionOptions(maxTokens: number, jsonMode: boolean) {
  return {
    temperature: 0.1,
    max_tokens: maxTokens,
    ...(jsonMode ? { response_format: { type: "json_object" as const } } : {}),
  };
}

async function callOpenAiCompatible(args: {
  provider: VisionProviderId;
  apiKey: string;
  baseURL?: string;
  model: string;
  prompt: string;
  imageBase64s: string[];
  imageMimeTypes: string[];
  maxTokens: number;
}): Promise<{ text: string; finishReason: string | null }> {
  const client = new OpenAI({
    apiKey: args.apiKey,
    ...(args.baseURL ? { baseURL: args.baseURL } : {}),
  });
  const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    { type: "text", text: args.prompt },
    ...args.imageBase64s.map(
      (b64, index): OpenAI.Chat.Completions.ChatCompletionContentPart => ({
        type: "image_url",
        image_url: {
          url: imageDataUrl(b64, args.imageMimeTypes[index] ?? "image/jpeg"),
        },
      }),
    ),
  ];

  let jsonMode = true;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await client.chat.completions.create({
        model: args.model,
        messages: [{ role: "user", content }],
        ...openAiCompletionOptions(args.maxTokens, jsonMode),
      });
      return {
        text: response.choices[0]?.message?.content ?? "",
        finishReason: response.choices[0]?.finish_reason ?? null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (
        jsonMode &&
        /response_format|json_object|unsupported/i.test(message)
      ) {
        jsonMode = false;
        continue;
      }
      throw err;
    }
  }
  return { text: "", finishReason: null };
}

async function callXaiResponses(args: {
  prompt: string;
  imageBase64s: string[];
  imageMimeTypes: string[];
  maxTokens: number;
}): Promise<{ text: string; finishReason: string | null }> {
  const apiKey = getXaiApiKey();
  if (!apiKey) throw new Error("xAI API key not configured");

  const content = [
    ...args.imageBase64s.map((b64, index) => ({
      type: "input_image" as const,
      image_url: imageDataUrl(b64, args.imageMimeTypes[index] ?? "image/jpeg"),
      detail: "high" as const,
    })),
    { type: "input_text" as const, text: args.prompt },
  ];

  const base = getXaiBaseUrl().replace(/\/$/, "");
  const res = await fetch(`${base}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: getXaiVisionModel(),
      input: [{ role: "user", content }],
      max_output_tokens: args.maxTokens,
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(raw.slice(0, 500) || `xAI HTTP ${res.status}`);
  }

  const data = JSON.parse(raw) as {
    output_text?: string;
    output?: Array<{ type?: string; content?: Array<{ text?: string }> }>;
  };

  const text =
    data.output_text ??
    data.output
      ?.flatMap((part) => part.content ?? [])
      .map((c) => c.text ?? "")
      .join("") ??
    "";

  return { text, finishReason: null };
}

async function callGemini(args: {
  prompt: string;
  imageBase64s: string[];
  imageMimeTypes: string[];
  maxTokens: number;
  model?: string;
}): Promise<{ text: string; finishReason: string | null }> {
  const genAI = new GoogleGenerativeAI(getGeminiApiKey()!);
  const model = genAI.getGenerativeModel({
    model: args.model ?? getGeminiVisionModel(),
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: args.maxTokens,
      responseMimeType: "application/json",
    },
  });
  const parts = [
    { text: args.prompt },
    ...args.imageBase64s.map((b64, index) => ({
      inlineData: {
        mimeType: args.imageMimeTypes[index] ?? "image/jpeg",
        data: b64,
      },
    })),
  ];
  const result = await model.generateContent({
    contents: [{ role: "user", parts }],
  });
  return { text: result.response.text(), finishReason: null };
}

function parseModelText(
  text: string,
  provider: VisionProviderId,
): VisionRunResult {
  const parsed = parseVisionCardsFromText(text);
  return { ...parsed, provider };
}

async function invokeProvider(
  id: VisionProviderId,
  prompt: string,
  imageBase64s: string[],
  imageMimeTypes: string[],
  maxTokens: number,
): Promise<{ text: string; finishReason: string | null }> {
  switch (id) {
    case "groq":
      return callOpenAiCompatible({
        provider: id,
        apiKey: getGroqApiKey()!,
        baseURL: "https://api.groq.com/openai/v1",
        model: getGroqVisionModel(),
        prompt,
        imageBase64s,
        imageMimeTypes,
        maxTokens,
      });
    case "openrouter":
      return callOpenAiCompatible({
        provider: id,
        apiKey: getOpenRouterApiKey()!,
        baseURL: getOpenRouterBaseUrl(),
        model: getOpenRouterVisionModel(),
        prompt,
        imageBase64s,
        imageMimeTypes,
        maxTokens,
      });
    case "openai":
      return callOpenAiCompatible({
        provider: id,
        apiKey: getOpenAIApiKey()!,
        model: getOpenAIVisionModel(),
        prompt,
        imageBase64s,
        imageMimeTypes,
        maxTokens,
      });
    case "xai": {
      try {
        return await callXaiResponses({
          prompt,
          imageBase64s,
          imageMimeTypes,
          maxTokens,
        });
      } catch {
        return callOpenAiCompatible({
          provider: id,
          apiKey: getXaiApiKey()!,
          baseURL: getXaiBaseUrl(),
          model: getXaiVisionModel(),
          prompt,
          imageBase64s,
          imageMimeTypes,
          maxTokens,
        });
      }
    }
    case "gemini":
      return callGemini({ prompt, imageBase64s, imageMimeTypes, maxTokens });
    default:
      throw new Error(`Unknown vision provider: ${id}`);
  }
}

export function isVisionProviderConfigured(id: VisionProviderId): boolean {
  switch (id) {
    case "groq":
      return Boolean(getGroqApiKey());
    case "gemini":
      return Boolean(getGeminiApiKey());
    case "openrouter":
      return Boolean(getOpenRouterApiKey());
    case "openai":
      return Boolean(getOpenAIApiKey());
    case "xai":
      return Boolean(getXaiApiKey());
    default:
      return false;
  }
}

function filterEnabledProviders(order: string[]): VisionProviderId[] {
  const skip = new Set(getVisionSkipProviders());
  return order.filter(
    (id): id is VisionProviderId =>
      (id === "groq" ||
        id === "gemini" ||
        id === "openrouter" ||
        id === "openai" ||
        id === "xai") &&
      isVisionProviderConfigured(id) &&
      !skip.has(id) &&
      !isProviderInCooldown(id),
  );
}

export function listEnabledVisionProviders(): VisionProviderId[] {
  return filterEnabledProviders(getVisionProviderOrder());
}

export function listEnabledVisionProvidersForBinderGrid(): VisionProviderId[] {
  return filterEnabledProviders(getVisionProviderOrderForBinderGrid());
}

export function formatVisionProviderError(
  id: VisionProviderId,
  err: unknown,
): string {
  const message = err instanceof Error ? err.message : String(err);
  if (isQuotaOrRateLimitError(err)) {
    return `${id}: quota or rate limit (skipped for ~${Math.ceil(getProviderCooldownRemainingMs(id) / 60_000) || 15} min)`;
  }
  if (/timed out/i.test(message)) {
    return `${id}: timed out`;
  }
  if (isJsonParseFailure(err)) {
    return `${id}: invalid or truncated JSON`;
  }
  return `${id}: ${message}`;
}

export type VisionExtractAttempt = {
  provider: VisionProviderId;
  run: (prompt: string, compact: boolean) => Promise<VisionRunResult>;
};

export async function runVisionProviderOnce(
  id: VisionProviderId,
  prompt: string,
  compactPrompt: string,
  imageBase64s: string[],
  imageMimeTypes: string[],
  options: {
    allowCompactRetry?: boolean;
    compactDensePrompt?: string;
    /** Override model for Gemini-only runs (e.g. verify pass). */
    geminiModelOverride?: string;
  } = {},
): Promise<VisionRunResult> {
  const maxTokens = getVisionMaxOutputTokensForProvider(id);
  const allowCompact = options.allowCompactRetry !== false;
  const densePrompt = options.compactDensePrompt;
  const geminiModelOverride = options.geminiModelOverride;

  const runPass = async (
    textPrompt: string,
    compact: boolean,
    dense = false,
  ): Promise<VisionRunResult> => {
    const { text, finishReason } =
      id === "gemini" && geminiModelOverride
        ? await callGemini({
            prompt: textPrompt,
            imageBase64s,
            imageMimeTypes,
            maxTokens,
            model: geminiModelOverride,
          })
        : await invokeProvider(
            id,
            textPrompt,
            imageBase64s,
            imageMimeTypes,
            maxTokens,
          );
    if (!text.trim()) throw new Error("empty model response");
    const result = parseModelText(text, id);
    result.finishReason = finishReason;
    result.compactRetry = compact;

    const truncated = finishReason === "length" || result.salvaged;
    if (truncated && allowCompact && !compact) {
      if (densePrompt) {
        const denseResult = await runPass(densePrompt, true, true);
        if (denseResult.cards.length >= result.cards.length) return denseResult;
      }
      const compactResult = await runPass(compactPrompt, true);
      if (compactResult.cards.length >= result.cards.length) return compactResult;
    }
    return result;
  };

  try {
    return await runPass(prompt, false);
  } catch (err) {
    if (!allowCompact || !isJsonParseFailure(err)) throw err;
    if (densePrompt) {
      try {
        return await runPass(densePrompt, true, true);
      } catch {
        // fall through to plain compact
      }
    }
    return runPass(compactPrompt, true);
  }
}

export function noteProviderFailure(id: VisionProviderId, err: unknown): void {
  if (!isQuotaOrRateLimitError(err)) return;
  const retryMs = parseRetryAfterMs(err) ?? 15 * 60 * 1000;
  markProviderCooldown(id, retryMs);
}

export {
  getVisionMaxOutputTokens,
  getVisionMaxOutputTokensForProvider,
  getVisionProviderTimeoutMs,
} from "@/lib/ai/env";

export { getGeminiVisionVerifyModel } from "@/lib/ai/env";
