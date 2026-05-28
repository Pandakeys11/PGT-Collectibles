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

const PREMIUM_GRADE_BRIEF_SYSTEM = `You are PGT Liquid Vault **senior graded-market research** — use Google Search and any session comps provided. Be sharp, specific, and dealer-grade accurate.

The user wants a **premium graded comp sheet** for one Pokémon/card identity. Plain scannable prose (short paragraphs + tight bullets). Do NOT ask them to upload photos or use Liquid Scan.

Required sections (use these exact headings as bold lines):
**PSA 10** — 2–4 recent solds with $ and dates; sold range (low–high); current live ask range; liquidity note (hot / steady / thin)
**BGS Black Label** — same; explicitly state if no public sales in 90d
**CGC 10 / Pristine** — same; distinguish CGC Pristine 10 vs CGC 9.5 / Gem Mint 10

Rules:
- Lead with card name, set, collector number, year, holo/rarity, and print run (1st Ed / Unlimited / Reverse) in one sentence.
- Separate **sold** vs **listed/asking** for each tier — never blend raw with graded.
- Prefer sales from the last 60–90 days; flag older outliers.
- When session comps are provided, reconcile them with web search — call out agreement or divergence.
- For vintage Base/Jungle/Fossil, **1st Edition vs Unlimited** must be explicit when price-relevant.
- Use "as of {today}" language; cite source types (eBay sold, PWCC, Goldin, Card Ladder, Heritage) — no invented URLs.
- If a tier is thin, say so and give the best available proxy (e.g. PSA 10 only).
- End with one line: indicative research — verify before buying or selling.`;

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

function formatSessionCompLines(
  rows: Array<{
    kind: string;
    title: string;
    priceUsd: number | null;
    observedAt: string | null;
    source: string | null;
    slab: string | null;
  }>,
): string {
  const graded = rows.filter(
    (r) =>
      r.priceUsd != null &&
      /psa\s*10|black\s*label|bgs|cgc|pristine/i.test(`${r.slab ?? ""} ${r.title}`),
  );
  if (!graded.length) return "";
  return graded
    .slice(0, 12)
    .map((r) => {
      const date = r.observedAt ?? "date n/a";
      const src = r.source ?? "session";
      const slab = r.slab ? ` · ${r.slab}` : "";
      return `• $${Math.round(r.priceUsd!)} · ${date} · ${src}${slab} — ${r.title.slice(0, 100)}`;
    })
    .join("\n");
}

export async function runPremiumGradeWebBrief(
  card: Pick<ExtractedCard, "name" | "set" | "number" | "year" | "rarity" | "printStamps">,
  options?: {
    proTier?: boolean;
    sessionEvidence?: Array<{
      kind: string;
      title: string;
      priceUsd: number | null;
      observedAt: string | null;
      source: string | null;
      slab: string | null;
    }>;
  },
): Promise<PremiumGradeBriefResult> {
  const todayUtc = new Date().toISOString().slice(0, 10);
  const userMessage = buildPremiumGradesAskMessage(card);
  const sessionBlock = options?.sessionEvidence?.length
    ? `\n\nSession comps from this scan (reconcile with web — do not ignore):\n${formatSessionCompLines(options.sessionEvidence)}`
    : "";
  const fullPrompt = `${PREMIUM_GRADE_BRIEF_SYSTEM}\n\nToday's date (UTC): ${todayUtc}\n\n${userMessage}${sessionBlock}`;

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
                content: `Today's date (UTC): ${todayUtc}\n\n${userMessage}${sessionBlock}`,
              },
            ],
            temperature: 0.2,
            max_tokens: 2_400,
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
