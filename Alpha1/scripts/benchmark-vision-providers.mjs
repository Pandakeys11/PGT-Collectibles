/**
 * Backend vision provider benchmark — same prompt + smoke test image as smoke-scan.mjs.
 *
 * Usage:
 *   node scripts/benchmark-vision-providers.mjs
 *   node scripts/benchmark-vision-providers.mjs --providers groq,xai,openrouter
 *   node scripts/benchmark-vision-providers.mjs --image path/to/card.png
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadEnvLocal } from "./load-env-local.mjs";

loadEnvLocal();

const DEFAULT_IMAGE = join(
  process.cwd(),
  "public",
  "catalog-variant-artwork",
  "base6",
  "base6-3_reverse.png",
);

const args = process.argv.slice(2);
const imagePath = args.includes("--image")
  ? args[args.indexOf("--image") + 1]
  : DEFAULT_IMAGE;
const filterProviders = args.includes("--providers")
  ? args[args.indexOf("--providers") + 1].split(",").map((s) => s.trim().toLowerCase())
  : null;

const imageBase64 = readFileSync(imagePath).toString("base64");
const mimeType = imagePath.endsWith(".png") ? "image/png" : "image/jpeg";

const VISION_PROMPT = `You are a Pokémon / TCG vision extractor. This image is a **tight crop of ONE card or slab**.

Return JSON only:
{"cards":[{"encapsulation":"raw|graded_slab","name":"","printedName":"","language":"","set":"","number":"","year":"","rarity":"","printStamps":"","details":"","grader":null,"grade":null,"cert":null,"extractedPrice":null,"stickerNote":null,"location":[500,500]}]}

Rules:
- Return **exactly one** card object.
- Raw cards: cert/grader/grade null.
- **name** should be the English Pokemon TCG catalog name when you can confidently map it.`;

function extractJsonPayload(text) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]?.trim()) return fenced[1].trim();
  const cardsKey = trimmed.indexOf('{"cards"');
  if (cardsKey >= 0) return trimmed.slice(cardsKey);
  return trimmed;
}

function parseCards(text) {
  const payload = extractJsonPayload(text);
  try {
    const parsed = JSON.parse(payload);
    return Array.isArray(parsed.cards) ? parsed.cards : [];
  } catch {
    return [];
  }
}

function scoreCard(card) {
  if (!card || typeof card !== "object") return 0;
  let score = 0;
  const fields = [
    "name",
    "set",
    "number",
    "year",
    "encapsulation",
    "language",
    "printedName",
  ];
  for (const f of fields) {
    const v = card[f];
    if (v != null && String(v).trim() !== "") score += 10;
  }
  if (card.encapsulation === "graded_slab" && card.grader) score += 5;
  if (card.encapsulation === "raw") score += 3;
  return score;
}

async function callOpenAiCompatible({ label, apiKey, baseURL, model }) {
  const t0 = Date.now();
  const content = [
    { type: "text", text: VISION_PROMPT },
    {
      type: "image_url",
      image_url: { url: `data:${mimeType};base64,${imageBase64}` },
    },
  ];

  const res = await fetch(`${baseURL.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content }],
      temperature: 0.1,
      max_tokens: 4096,
      response_format: { type: "json_object" },
    }),
  });

  const latencyMs = Date.now() - t0;
  const raw = await res.text();
  if (!res.ok) {
    return { label, ok: false, latencyMs, error: raw.slice(0, 400) };
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return { label, ok: false, latencyMs, error: "invalid JSON response" };
  }

  const text = data.choices?.[0]?.message?.content ?? "";
  const cards = parseCards(text);
  const card = cards[0] ?? null;
  const quality = scoreCard(card);

  return {
    label,
    ok: true,
    latencyMs,
    model,
    finishReason: data.choices?.[0]?.finish_reason ?? null,
    cardCount: cards.length,
    quality,
    card,
    rawPreview: text.slice(0, 200).replace(/\s+/g, " "),
  };
}

async function callXaiResponses({ apiKey, model }) {
  const t0 = Date.now();
  const res = await fetch("https://api.x.ai/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_image",
              image_url: `data:${mimeType};base64,${imageBase64}`,
              detail: "high",
            },
            { type: "input_text", text: VISION_PROMPT },
          ],
        },
      ],
    }),
  });

  const latencyMs = Date.now() - t0;
  const raw = await res.text();
  if (!res.ok) {
    return {
      label: `xai:${model}`,
      ok: false,
      latencyMs,
      error: raw.slice(0, 400),
    };
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return { label: `xai:${model}`, ok: false, latencyMs, error: "invalid JSON" };
  }

  const text =
    data.output_text ??
    data.output?.find?.((o) => o.type === "message")?.content?.[0]?.text ??
    data.choices?.[0]?.message?.content ??
    "";

  const cards = parseCards(typeof text === "string" ? text : JSON.stringify(text));
  const card = cards[0] ?? null;

  return {
    label: `xai:${model}`,
    ok: true,
    latencyMs,
    model,
    cardCount: cards.length,
    quality: scoreCard(card),
    card,
    rawPreview: String(text).slice(0, 200).replace(/\s+/g, " "),
  };
}

function getXaiKey() {
  return (
    process.env.XAI_API_KEY?.trim() ||
    process.env.XAi_API_KEY?.trim() ||
    process.env.GROK_API_KEY?.trim() ||
    null
  );
}

function buildProviderList() {
  const list = [];

  if (process.env.GROQ_API_KEY?.trim()) {
    list.push({
      id: "groq",
      run: () =>
        callOpenAiCompatible({
          label: "groq",
          apiKey: process.env.GROQ_API_KEY,
          baseURL: "https://api.groq.com/openai/v1",
          model:
            process.env.GROQ_VISION_MODEL?.trim() ||
            "meta-llama/llama-4-scout-17b-16e-instruct",
        }),
    });
  }

  if (process.env.OPENROUTER_API_KEY?.trim()) {
    list.push({
      id: "openrouter",
      run: () =>
        callOpenAiCompatible({
          label: "openrouter",
          apiKey: process.env.OPENROUTER_API_KEY,
          baseURL:
            process.env.OPENROUTER_BASE_URL?.trim() ||
            "https://openrouter.ai/api/v1",
          model:
            process.env.OPENROUTER_VISION_MODEL?.trim() ||
            "nvidia/nemotron-nano-12b-v2-vl:free",
        }),
    });
  }

  if (process.env.GEMINI_API_KEY?.trim()) {
    list.push({
      id: "gemini",
      run: async () => {
        const t0 = Date.now();
        const model =
          process.env.GEMINI_VISION_MODEL?.trim() || "gemini-2.5-flash";
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  { text: VISION_PROMPT },
                  { inlineData: { mimeType, data: imageBase64 } },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 4096,
              responseMimeType: "application/json",
            },
          }),
        });
        const latencyMs = Date.now() - t0;
        const raw = await res.text();
        if (!res.ok) {
          return { label: "gemini", ok: false, latencyMs, error: raw.slice(0, 400) };
        }
        const data = JSON.parse(raw);
        const text =
          data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "";
        const cards = parseCards(text);
        const card = cards[0] ?? null;
        return {
          label: "gemini",
          ok: true,
          latencyMs,
          model,
          cardCount: cards.length,
          quality: scoreCard(card),
          card,
          rawPreview: text.slice(0, 200).replace(/\s+/g, " "),
        };
      },
    });
  }

  if (process.env.OPENAI_API_KEY?.trim()) {
    list.push({
      id: "openai",
      run: () =>
        callOpenAiCompatible({
          label: "openai",
          apiKey: process.env.OPENAI_API_KEY,
          baseURL: "https://api.openai.com/v1",
          model: process.env.OPENAI_VISION_MODEL?.trim() || "gpt-4o-mini",
        }),
    });
  }

  const xaiKey = getXaiKey();
  if (xaiKey) {
    const xaiModel =
      process.env.XAI_VISION_MODEL?.trim() ||
      process.env.GROK_VISION_MODEL?.trim() ||
      "grok-4-1-fast-non-reasoning";
    list.push({
      id: "xai",
      run: async () => {
        const responses = await callXaiResponses({ apiKey: xaiKey, model: xaiModel });
        if (responses.ok) return { ...responses, label: "xai" };
        const chat = await callOpenAiCompatible({
          label: "xai-chat",
          apiKey: xaiKey,
          baseURL: "https://api.x.ai/v1",
          model: xaiModel,
        });
        if (chat.ok) return { ...chat, label: "xai" };
        return responses;
      },
    });
  }

  return filterProviders
    ? list.filter((p) => filterProviders.includes(p.id))
    : list;
}

async function main() {
  console.log(`Benchmark image: ${imagePath}\n`);

  const providers = buildProviderList();
  if (providers.length === 0) {
    console.error("No providers configured. Set API keys in .env.local");
    process.exit(1);
  }

  const results = [];
  for (const provider of providers) {
    process.stdout.write(`Testing ${provider.id}… `);
    try {
      const result = await provider.run();
      results.push(result);
      console.log(
        result.ok
          ? `OK ${result.latencyMs}ms quality=${result.quality}`
          : `FAIL ${result.latencyMs}ms`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ label: provider.id, ok: false, latencyMs: 0, error: msg });
      console.log(`ERROR ${msg.slice(0, 80)}`);
    }
  }

  const ranked = [...results]
    .filter((r) => r.ok)
    .sort((a, b) => {
      if (b.quality !== a.quality) return b.quality - a.quality;
      return a.latencyMs - b.latencyMs;
    });

  console.log("\n--- Rankings (quality score, then speed) ---\n");
  let rank = 1;
  for (const r of ranked) {
    const c = r.card ?? {};
    console.log(
      `#${rank} ${r.label} — score ${r.quality}, ${r.latencyMs}ms, model=${r.model ?? "?"}`,
    );
    console.log(
      `     name=${c.name ?? "?"} | set=${c.set ?? "?"} | #=${c.number ?? "?"} | year=${c.year ?? "?"}`,
    );
    rank += 1;
  }

  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.log("\n--- Failed ---\n");
    for (const r of failed) {
      console.log(`${r.label}: ${r.error ?? "unknown"}`);
    }
  }

  if (ranked[0]) {
    console.log(`\nWinner: ${ranked[0].label} (quality ${ranked[0].quality}, ${ranked[0].latencyMs}ms)`);
  }

  const xaiPresent = Boolean(getXaiKey());
  console.log(`\nxAI key: ${xaiPresent ? "configured (XAI_API_KEY / XAi_API_KEY)" : "missing"}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
