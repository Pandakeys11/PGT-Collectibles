import OpenAI from "openai";
import { getGroqApiKey, getGroqCompoundModel } from "@/lib/ai/env";
import {
  getSetInsightGroqMaxTokens,
  isAiRateLimitError,
  markAiResearchCooldown,
} from "@/lib/ai/research-budget";
import { withTimeout } from "@/lib/async-timeout";
import type { SetInsightPriceCard, SetInsightSealedProduct } from "@/lib/catalog/set-insight-payload";

export type GroqSetInsightRaw = {
  summary?: string;
  marketPulse?: string;
  chaseNotes?: string;
  topValueCards?: Array<{
    name?: string;
    number?: string;
    rarity?: string;
    priceUsd?: number | null;
    priceLabel?: string;
    note?: string;
  }>;
  momentumCards?: Array<{
    name?: string;
    number?: string;
    momentumPct?: number | null;
    priceUsd?: number | null;
    note?: string;
  }>;
  promoCards?: Array<{
    name?: string;
    number?: string;
    note?: string;
    priceUsd?: number | null;
  }>;
  sealedProducts?: Array<{
    label?: string;
    priceUsd?: number | null;
    priceLabel?: string;
    note?: string;
  }>;
  references?: Array<{ label?: string; url?: string }>;
};

const SET_INSIGHT_SYSTEM = `You are PGT Set Intel — a sharp Pokémon TCG set market analyst with live web search.

Use the web to find current, verifiable market color for the requested set: chase cards, typical raw and graded price bands, sealed product street prices, promos, and short-term momentum where visible (TCGPlayer, eBay sold, Cardmarket, PriceCharting, reputable hobby press).

Rules:
- Return ONLY valid JSON matching the schema — no markdown fences.
- USD prices as numbers when you have a defensible anchor; otherwise null with a note.
- Label each price basis in priceLabel: SOLD, ACTIVE, REFERENCE, or TCGPlayer market.
- Name real cards from the set; do not invent card names not in the set.
- Prefer cards the user catalog hints mention when they match your research.
- momentumPct is Cardmarket-style % move vs recent average when you find it; else null.
- sealedProducts: booster box, ETB, booster bundle, PC ETB, etc. with realistic street ranges.
- references: 2–4 authoritative URLs you actually used (TCGPlayer set page, Bulbapedia, etc.).
- Be concise, institutional, and accurate — no hype.
- Catalog TCGPlayer anchors in the prompt are authoritative for raw singles unless your web sold data is clearly fresher (label SOLD/ACTIVE).
- Sealed prices: street ranges only; label ACTIVE or SOLD when known.`;

function buildUserPrompt(input: {
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
CATALOG CARDS IN DB: ${input.cardCount}
CATALOG ROWS WITH TCGPLAYER SNAPSHOT: ${input.pricedSlots}

Catalog card names (anchor your research — verify prices on the web):
${input.catalogHints.slice(0, 20).map((n) => `- ${n}`).join("\n") || "- (none listed)"}

JSON schema:
{
  "summary": "string (2-3 sentences)",
  "marketPulse": "string (one line)",
  "chaseNotes": "string (chase / grail / sealed demand)",
  "topValueCards": [{ "name", "number", "rarity", "priceUsd", "priceLabel", "note" }],
  "momentumCards": [{ "name", "number", "momentumPct", "priceUsd", "note" }],
  "promoCards": [{ "name", "number", "priceUsd", "note" }],
  "sealedProducts": [{ "label", "priceUsd", "priceLabel", "note" }],
  "references": [{ "label", "url" }]
}`;
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[$,]/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function asString(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

export function parseGroqSetInsightJson(text: string): GroqSetInsightRaw | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? text;
  try {
    return JSON.parse(fenced.trim()) as GroqSetInsightRaw;
  } catch {
    return null;
  }
}

export function groqRawToCards(
  rows: GroqSetInsightRaw["topValueCards"] | undefined,
): SetInsightPriceCard[] {
  if (!rows?.length) return [];
  return rows
    .map((r) => ({
      name: asString(r.name) ?? "Unknown",
      number: asString(r.number),
      rarity: asString(r.rarity),
      priceUsd: asNumber(r.priceUsd),
      priceLabel: asString(r.priceLabel),
      note: asString(r.note),
    }))
    .filter((r) => r.name !== "Unknown")
    .slice(0, 8);
}

export function groqRawToMomentum(
  rows: GroqSetInsightRaw["momentumCards"] | undefined,
): SetInsightPriceCard[] {
  if (!rows?.length) return [];
  return rows
    .map((r) => ({
      name: asString(r.name) ?? "Unknown",
      number: asString(r.number),
      momentumPct: asNumber(r.momentumPct),
      priceUsd: asNumber(r.priceUsd),
      note: asString(r.note),
    }))
    .filter((r) => r.name !== "Unknown")
    .slice(0, 6);
}

export function groqRawToPromos(
  rows: GroqSetInsightRaw["promoCards"] | undefined,
): SetInsightPriceCard[] {
  if (!rows?.length) return [];
  return rows
    .map((r) => ({
      name: asString(r.name) ?? "Unknown",
      number: asString(r.number),
      priceUsd: asNumber(r.priceUsd),
      note: asString(r.note),
    }))
    .filter((r) => r.name !== "Unknown")
    .slice(0, 6);
}

export function groqRawToSealed(
  rows: GroqSetInsightRaw["sealedProducts"] | undefined,
): SetInsightSealedProduct[] {
  if (!rows?.length) return [];
  return rows
    .map((r) => ({
      label: asString(r.label) ?? "Sealed product",
      priceUsd: asNumber(r.priceUsd),
      priceLabel: asString(r.priceLabel),
      note: asString(r.note),
    }))
    .slice(0, 8);
}

export function isSetInsightGroqConfigured(): boolean {
  return Boolean(getGroqApiKey());
}

export async function researchSetInsightWithGroq(input: {
  setId: string;
  setName: string;
  releaseDate: string | null;
  cardCount: number;
  catalogHints: string[];
  pricedSlots: number;
}): Promise<{ raw: GroqSetInsightRaw; model: string } | null> {
  const key = getGroqApiKey();
  if (!key) return null;

  const client = new OpenAI({ apiKey: key, baseURL: "https://api.groq.com/openai/v1" });
  const model = getGroqCompoundModel();
  const todayUtc = new Date().toISOString().slice(0, 10);

  try {
    const response = await withTimeout(
      client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: SET_INSIGHT_SYSTEM },
          { role: "user", content: buildUserPrompt({ ...input, todayUtc }) },
        ],
        temperature: 0.2,
        max_tokens: getSetInsightGroqMaxTokens(),
        response_format: { type: "json_object" },
      }),
      85_000,
      "set insight groq",
    );
    const text = response.choices[0]?.message?.content?.trim() ?? "";
    const raw = parseGroqSetInsightJson(text);
    if (!raw) return null;
    return { raw, model };
  } catch (err) {
    if (isAiRateLimitError(err)) markAiResearchCooldown("groq");
    return null;
  }
}
