/**
 * One-off: run Groq vision (same stack as Liquid Scan) on a binder/grid photo.
 * Usage: node scripts/probe-binder-grid.mjs <path-to-image>
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { loadEnvLocal } from "./load-env-local.mjs";

loadEnvLocal();

const imagePath = process.argv[2];
if (!imagePath || !existsSync(imagePath)) {
  console.error("Usage: node scripts/probe-binder-grid.mjs <image-path>");
  process.exit(1);
}

const key = process.env.GROQ_API_KEY?.trim() ?? "";
const visionModel =
  process.env.GROQ_VISION_MODEL?.trim() || "meta-llama/llama-4-scout-17b-16e-instruct";
const maxTokens = Number(process.env.GROQ_VISION_MAX_OUTPUT_TOKENS) || 6144;

if (!key || key.length < 20) {
  console.error("GROQ_API_KEY required in .env.local");
  process.exit(1);
}

const ext = imagePath.toLowerCase().endsWith(".png") ? "png" : "jpeg";
const b64 = readFileSync(imagePath).toString("base64");

const prompt = `You are a multi-franchise trading-card vision extractor. The image shows a grid of Pokémon TCG cards (binder-style layout).

Return JSON only:
{"cards":[{"franchise":"pokemon","encapsulation":"raw","name":"","printedName":"","language":"","set":"","number":"","year":"","rarity":"","printStamps":"","details":"","grader":null,"grade":null,"cert":null,"location":[y,x]}]}

Rules:
- One entry per visible trading card (row-major: left→right, top→bottom).
- location: card center on 0-1000 (y down, x right).
- **name** = English catalog Pokémon name; **printedName** = visible title.
- **set** = full English set name (Base Set, Jungle, Fossil, Neo Genesis, Neo Revelation, Neo Destiny, etc.).
- **number** = collector number as printed (e.g. 10/62, 4/102).
- **printStamps**: 1st Edition, Shadowless, Unlimited, Holo, Reverse Holo, PRERELEASE, Japanese — only when visible.
- **language**: English or Japanese when clear.
- Keep **details** under 80 characters per card.
- Include EVERY visible card in the grid.`;

const t0 = Date.now();
const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: visionModel,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: { url: `data:image/${ext};base64,${b64}` },
          },
        ],
      },
    ],
    max_tokens: maxTokens,
    temperature: 0,
  }),
});

const text = await res.text();
let json = null;
try {
  json = JSON.parse(text);
} catch {
  /* ignore */
}

if (!res.ok) {
  console.error("HTTP", res.status, text.slice(0, 800));
  process.exit(1);
}

const content = json?.choices?.[0]?.message?.content?.trim() ?? "";
const ms = Date.now() - t0;

function extractPayload(raw) {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const i = raw.indexOf('{"cards"');
  if (i >= 0) return raw.slice(i);
  const alt = raw.indexOf('"cards"');
  if (alt >= 0) {
    const brace = raw.lastIndexOf("{", alt);
    if (brace >= 0) return raw.slice(brace);
  }
  return raw;
}

function salvageCompleteCardObjects(payload) {
  const cardsKey = payload.indexOf('"cards"');
  if (cardsKey < 0) return [];
  const bracketStart = payload.indexOf("[", cardsKey);
  if (bracketStart < 0) return [];
  const cards = [];
  let i = bracketStart + 1;
  while (i < payload.length) {
    while (i < payload.length && /[\s,]/.test(payload[i])) i += 1;
    if (i >= payload.length || payload[i] === "]") break;
    if (payload[i] !== "{") break;
    const objStart = i;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (; i < payload.length; i += 1) {
      const c = payload[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (c === "\\") escaped = true;
        else if (c === '"') inString = false;
        continue;
      }
      if (c === '"') {
        inString = true;
        continue;
      }
      if (c === "{") depth += 1;
      if (c === "}") {
        depth -= 1;
        if (depth === 0) {
          try {
            cards.push(JSON.parse(payload.slice(objStart, i + 1)));
          } catch {
            /* skip */
          }
          i += 1;
          break;
        }
      }
    }
    if (depth !== 0) break;
  }
  return cards;
}

function parseCards(text) {
  const payload = extractPayload(text);
  try {
    const parsed = JSON.parse(payload);
    if (Array.isArray(parsed.cards) && parsed.cards.length) {
      return { cards: parsed.cards, salvaged: false };
    }
  } catch {
    /* repair */
  }
  const trimmed = payload.trim();
  const lastObjComma = trimmed.lastIndexOf("},");
  const attempts = [];
  if (lastObjComma > 0) attempts.push(`${trimmed.slice(0, lastObjComma + 1)}]}`);
  const lastObj = trimmed.lastIndexOf("}");
  if (lastObj > 0) attempts.push(`${trimmed.slice(0, lastObj + 1)}]}`);
  attempts.push(`${trimmed}]}`);
  for (const repaired of attempts) {
    try {
      const parsed = JSON.parse(repaired);
      if (Array.isArray(parsed.cards) && parsed.cards.length) {
        return { cards: parsed.cards, salvaged: true };
      }
    } catch {
      /* next */
    }
  }
  const salvaged = salvageCompleteCardObjects(payload);
  if (salvaged.length) return { cards: salvaged, salvaged: true };
  throw new Error("Could not parse vision JSON");
}

let cards = [];
let salvaged = false;
try {
  const parsed = parseCards(content);
  cards = parsed.cards;
  salvaged = parsed.salvaged;
} catch (e) {
  console.error("Parse failed:", e.message);
  console.log("Raw snippet:", content.slice(0, 2000));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      model: visionModel,
      elapsedMs: ms,
      cardCount: cards.length,
      salvaged,
      finishReason: json?.choices?.[0]?.finish_reason ?? null,
      usage: json?.usage ?? null,
      cards: cards.map((c, i) => ({
        index: i + 1,
        name: c.name,
        set: c.set,
        number: c.number,
        printStamps: c.printStamps,
        language: c.language,
        rarity: c.rarity,
        location: c.location,
      })),
    },
    null,
    2,
  ),
);
