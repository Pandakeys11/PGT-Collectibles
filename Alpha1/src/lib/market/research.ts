import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { completePlainText } from "@/lib/ai/text";
import {
  getGeminiApiKey,
  isGeminiServiceEnabled,
  getGeminiTextModel,
  getGroqApiKey,
  getGroqCompoundModel,
  getMarketNightlyAiOrder,
  getMarketNightlyMemoryFreshDays,
  getMarketNightlyOpenRouterModel,
  getOpenRouterApiKey,
  getOpenRouterBaseUrl,
} from "@/lib/ai/env";
import {
  getMarketScanAiOrder,
  isAiRateLimitError,
  isAiResearchInCooldown,
  markAiResearchCooldown,
} from "@/lib/ai/research-budget";
import type { CatalogMarketIntel } from "@/lib/pgt-registry/pgt-market-intel-persist";
import { deriveFairValueResult, type FairValueBasis } from "@/lib/market/fair-value";
import { buildMarketQueries } from "@/lib/market/queries";
import {
  buildMarketSourceLinks,
  inferMarketSourceFromUrl,
  normalizeMarketSource,
  sourceLabel,
  type MarketSourceId,
} from "@/lib/market/sources";
import { collectApiMarketEvidence } from "@/lib/market/adapters/run-api-evidence";
import { collectPremiumGradeLanes } from "@/lib/market/collect-premium-grade-lanes";
import { harvestGradedMarketEvidence } from "@/lib/market/graded-sales-harvest";
import { classifyCardLane } from "@/lib/scan/lane";
import { sanitizeEvidenceList } from "@/lib/market/evidence-dates";
import { withTimeout } from "@/lib/async-timeout";
import { searchWeb, type WebSearchResult } from "@/lib/market/web-search";
import { franchiseLabel } from "@/lib/scan/franchise";
import {
  inferCardTargetGradeBucket,
  inferEvidenceGradeBucket,
  inferMarketVenueType,
} from "@/lib/market/market-intelligence";
import { filterMarketEvidenceForCardIdentity } from "@/lib/market/market-evidence-identity";
import {
  hasInstitutionalMarketMemory,
  loadPersistedMarketEvidence,
} from "@/lib/market/persisted-market-evidence";
import type { ExtractedCard, MarketEvidence } from "@/lib/scan/schemas";
import { MARKET_MASTER_COMPACT_RESEARCH_RULES } from "@/lib/scanner-chat/market-master-guard-rails";

const MARKET_SOURCES_LINE =
  "eBay, Card Ladder, ALT, Goldin, PriceCharting, CardMarket, and TCGPlayer";

const RESEARCH_TODAY_ISO = new Date().toISOString().slice(0, 10);

const MARKET_JSON_SCHEMA = `{
  "marketEvidence": [
    {
      "kind": "sold|active|reference",
      "title": "string",
      "priceUsd": number|null,
      "observedAt": "ISO date yyyy-mm-dd or null",
      "url": "https url or null",
      "source": "eBay|Card Ladder|ALT|PriceCharting|CardMarket|TCGPlayer|null",
      "slab": "PSA 10|BGS Black Label|CGC 10|raw|null"
    }
  ]
}`;

const MARKET_ANALYST_SYSTEM = `You are Pokémon Market Master — senior trading-card market analyst (Pokémon TCG, other TCGs, sports). Pull the freshest **sold** comps and clearly labeled active asks from ${MARKET_SOURCES_LINE}.

Today's date is ${RESEARCH_TODAY_ISO} (reasoning only — not a fake observedAt).

${MARKET_MASTER_COMPACT_RESEARCH_RULES}

Card Ladder: use provided search URL; \`/ladder/card/...\` only when that exact URL appears in snippets.

Return only verifiable rows with real URLs, USD prices when visible, correct source label, and kind (sold|active|reference).
Prioritize PSA 10 and BGS Black Label **sold** comps when vintage, chase, or slab-relevant.

observedAt: null unless that calendar date appears verbatim in snippets/grounded text for that row — never invent dates or use set release/copyright years.`;

function parseMarketJson(text: string): MarketEvidence[] {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? text;
  const parsed = JSON.parse(fenced) as { marketEvidence?: unknown[] };
  if (!Array.isArray(parsed.marketEvidence)) return [];
  const evidence: MarketEvidence[] = [];
  for (const row of parsed.marketEvidence) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    const kind = item.kind;
    if (kind !== "sold" && kind !== "active" && kind !== "reference") continue;
    const title = String(item.title ?? "").trim();
    if (!title) continue;
    const priceUsd =
      typeof item.priceUsd === "number" && Number.isFinite(item.priceUsd) ? item.priceUsd : null;
    const observedAt =
      typeof item.observedAt === "string" && item.observedAt.trim() ? item.observedAt.trim() : null;
    const url = typeof item.url === "string" && item.url.startsWith("http") ? item.url.trim() : null;
    let sourceId = normalizeMarketSource(typeof item.source === "string" ? item.source : null);
    if (!sourceId && url) sourceId = inferMarketSourceFromUrl(url);
    const source = sourceId ? sourceLabel(sourceId) : null;
    const slab = typeof item.slab === "string" ? item.slab : null;
    evidence.push({ kind, title, priceUsd, observedAt, url, source, slab });
  }
  return evidence;
}

function parseUsd(text: string): number | null {
  const matches = Array.from(text.matchAll(/\$\s?([\d,]+(?:\.\d{2})?)/g));
  if (matches.length === 0) return null;
  const values = matches
    .map((match) => Number(match[1].replace(/,/g, "")))
    .filter((value) => Number.isFinite(value) && value >= 2 && value < 250_000);
  if (values.length === 0) return null;
  values.sort((a, b) => b - a);
  return values[0];
}

function inferKind(text: string): MarketEvidence["kind"] {
  if (/sold|completed|last sale|sale price|sold for|hammer/i.test(text)) return "sold";
  if (/listed|asking|buy it now|for sale|market price|in stock|available|on sale/i.test(text)) return "active";
  return "reference";
}

function inferSlab(text: string): string | null {
  if (/bgs.*black\s*label|black\s*label/i.test(text)) return "BGS Black Label";
  if (/psa\s*10\b|gem\s*mint\s*10/i.test(text)) return "PSA 10";
  if (/cgc/i.test(text) && /cgc\s*10(\.0)?\b/i.test(text)) return "CGC 10";
  if (/psa\s*9\b|cgc\s*9\b|bgs\s*9\b/i.test(text)) return "PSA 9";
  if (/raw\b|ungraded\b/i.test(text)) return "raw";
  return null;
}

function parseDate(text: string): string | null {
  const isoMatch = text.match(/(20\d{2})-(\d{2})-(\d{2})/);
  if (isoMatch && isoMatch.index != null) {
    const before = text.slice(Math.max(0, isoMatch.index - 6), isoMatch.index);
    if (/©|\(c\)|copyright/i.test(before)) return null;
    const y = Number(isoMatch[1]);
    const cy = new Date().getFullYear();
    if (y < 1999 || y > cy + 1) return null;
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }
  const named = text.match(
    /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(20\d{2})/i,
  );
  if (named) {
    const y = Number(named[3]);
    const cy = new Date().getFullYear();
    if (y < 1999 || y > cy + 1) return null;
    const date = new Date(`${named[1]} ${named[2]}, ${named[3]}`);
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  }
  const slash = text.match(/\b(0?[1-9]|1[0-2])[/-](0?[1-9]|[12]\d|3[01])[/-](20\d{2})\b/);
  if (slash) {
    const y = Number(slash[3]);
    const cy = new Date().getFullYear();
    if (y < 1999 || y > cy + 1) return null;
    const date = new Date(`${slash[1]}/${slash[2]}/${slash[3]}`);
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  }
  return null;
}

const SOURCE_DOMAIN_PATTERN: Record<MarketSourceId, RegExp> = {
  ebay: /ebay\.com/i,
  cardladder: /cardladder\.com/i,
  alt: /alt\.xyz/i,
  goldin: /goldin\.co/i,
  fanatics: /fanatics/i,
  pricecharting: /pricecharting\.com/i,
  cardmarket: /cardmarket\.com/i,
  tcgplayer: /tcgplayer\.com/i,
};

function evidenceFromSnippet(
  result: WebSearchResult,
  sourceId: MarketSourceId,
  lane: "sold" | "active",
): MarketEvidence | null {
  if (!SOURCE_DOMAIN_PATTERN[sourceId].test(result.url)) return null;
  const haystack = `${result.title} ${result.snippet} ${result.url}`;
  const priceUsd = parseUsd(haystack);
  const inferred = inferKind(haystack);
  const kind: MarketEvidence["kind"] = inferred === "reference" ? lane : inferred;
  if (kind === "sold" && priceUsd == null) return null;
  return {
    kind,
    title: result.title,
    priceUsd,
    observedAt: parseDate(haystack),
    url: result.url,
    source: sourceLabel(sourceId),
    slab: inferSlab(haystack),
  };
}

/** DuckDuckGo site-targeted snippets → structured sold/active rows (used by catalog market). */
export async function collectSnippetMarketEvidence(card: ExtractedCard): Promise<MarketEvidence[]> {
  const { heuristicEvidence } = await collectSourceSnippets(card);
  return heuristicEvidence;
}

async function collectSourceSnippets(card: ExtractedCard) {
  const queries = buildMarketQueries(card);
  const sourceIds = (
    ["ebay", "pricecharting", "tcgplayer", "cardladder", "alt", "goldin", "fanatics", "cardmarket"] as MarketSourceId[]
  ).filter((sourceId) => queries.bySource[sourceId]);
  const settled = await Promise.allSettled(
    sourceIds.flatMap((sourceId) => [
      searchWeb(queries.bySource[sourceId].sold, 3).then((results) => ({ sourceId, lane: "sold" as const, results })),
      searchWeb(queries.bySource[sourceId].active, 3).then((results) => ({
        sourceId,
        lane: "active" as const,
        results,
      })),
    ]),
  );

  const bundles: Array<{ sourceId: MarketSourceId; lane: "sold" | "active"; results: WebSearchResult[] }> = [];
  for (const result of settled) {
    if (result.status === "fulfilled") bundles.push(result.value);
  }

  const heuristicEvidence = bundles.flatMap((bundle) =>
    bundle.results
      .map((result) => evidenceFromSnippet(result, bundle.sourceId, bundle.lane))
      .filter((item): item is MarketEvidence => Boolean(item)),
  );

  return { bundles, heuristicEvidence, queries };
}

async function researchWithGemini(card: ExtractedCard, bundles: Awaited<ReturnType<typeof collectSourceSnippets>>["bundles"]) {
  if (isAiResearchInCooldown("gemini")) return [];
  const genAI = new GoogleGenerativeAI(getGeminiApiKey()!);
  const model = genAI.getGenerativeModel({
    model: getGeminiTextModel(),
    tools: [{ googleSearch: {} }] as never,
  });
  const prompt = `${MARKET_ANALYST_SYSTEM}

Card JSON:
${JSON.stringify(card, null, 2)}

Detected franchise/category: ${franchiseLabel(card)}

Required coverage:
1. Recent sold comps for the raw card.
2. Recent sold comps for PSA 10.
3. Recent sold comps for BGS Black Label when that grading lane is relevant.
4. Current active listings across ${MARKET_SOURCES_LINE}.

Source-targeted snippets:
${JSON.stringify(bundles, null, 2)}

observedAt policy: null unless a date string for that specific sale/list appears in snippets or grounded results for that URL — never guess from memory or set years.

Return JSON only matching:
${MARKET_JSON_SCHEMA}`;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });
    return parseMarketJson(result.response.text());
  } catch (err) {
    if (isAiRateLimitError(err)) markAiResearchCooldown("gemini");
    return [];
  }
}

async function researchWithGroqCompound(
  card: ExtractedCard,
  bundles: Awaited<ReturnType<typeof collectSourceSnippets>>["bundles"],
): Promise<MarketEvidence[]> {
  const key = getGroqApiKey();
  if (!key || isAiResearchInCooldown("groq")) return [];
  const client = new OpenAI({ apiKey: key, baseURL: "https://api.groq.com/openai/v1" });
  const model = getGroqCompoundModel();
  const prompt = `${MARKET_ANALYST_SYSTEM}

Card JSON:
${JSON.stringify(card, null, 2)}

Detected franchise/category: ${franchiseLabel(card)}

Source-targeted snippets:
${JSON.stringify(bundles, null, 2)}

Return JSON only matching:
${MARKET_JSON_SCHEMA}`;

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: MARKET_ANALYST_SYSTEM },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 1_400,
      response_format: { type: "json_object" },
    });
    const text = response.choices[0]?.message?.content?.trim() ?? "";
    if (!text) return [];
    return parseMarketJson(text);
  } catch (err) {
    if (isAiRateLimitError(err)) markAiResearchCooldown("groq");
    return [];
  }
}

async function researchWithOpenRouterMarket(
  card: ExtractedCard,
  bundles: Awaited<ReturnType<typeof collectSourceSnippets>>["bundles"],
): Promise<MarketEvidence[]> {
  const key = getOpenRouterApiKey();
  if (!key) return [];
  const client = new OpenAI({ apiKey: key, baseURL: getOpenRouterBaseUrl() });
  const model = getMarketNightlyOpenRouterModel();
  const prompt = `${MARKET_ANALYST_SYSTEM}

Card JSON:
${JSON.stringify(card, null, 2)}

Detected franchise/category: ${franchiseLabel(card)}

Source-targeted snippets:
${JSON.stringify(bundles, null, 2)}

Return JSON only matching:
${MARKET_JSON_SCHEMA}`;

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: MARKET_ANALYST_SYSTEM },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 1_400,
      response_format: { type: "json_object" },
    });
    const text = response.choices[0]?.message?.content?.trim() ?? "";
    if (!text) return [];
    return parseMarketJson(text);
  } catch {
    return [];
  }
}

function isNightlyMemoryFresh(intel: CatalogMarketIntel | null, freshDays: number): boolean {
  if (!intel?.comps.length) return false;
  let latest = 0;
  for (const row of intel.comps) {
    const t = Date.parse(row.ingestedAt);
    if (Number.isFinite(t) && t > latest) latest = t;
  }
  if (!latest) return false;
  const ageDays = (Date.now() - latest) / (24 * 60 * 60 * 1000);
  return ageDays <= freshDays;
}

/** Nightly batch: Gemini Google Search (free) → OpenRouter market model → snippet text fallback. */
async function collectNightlyAiEvidence(
  card: ExtractedCard,
  bundles: Awaited<ReturnType<typeof collectSourceSnippets>>["bundles"],
): Promise<MarketEvidence[]> {
  const order = getMarketNightlyAiOrder();
  const collected: MarketEvidence[] = [];

  for (const provider of order) {
    if (provider === "groq" && getGroqApiKey()) {
      const rows = await withTimeout(researchWithGroqCompound(card, bundles), 18_000, "nightly groq").catch(
        () => [],
      );
      collected.push(...rows);
      if (rows.filter((r) => r.kind === "sold" && r.priceUsd != null).length >= 3) break;
    }
    if (provider === "gemini" && isGeminiServiceEnabled()) {
      const rows = await withTimeout(researchWithGemini(card, bundles), 16_000, "nightly gemini").catch(
        () => [],
      );
      collected.push(...rows);
      if (rows.filter((r) => r.kind === "sold" && r.priceUsd != null).length >= 3) break;
    }
    if (provider === "openrouter" && getOpenRouterApiKey()) {
      const rows = await withTimeout(researchWithOpenRouterMarket(card, bundles), 14_000, "nightly openrouter").catch(
        () => [],
      );
      collected.push(...rows);
      if (rows.filter((r) => r.kind === "sold" && r.priceUsd != null).length >= 2) break;
    }
  }

  if (collected.length === 0) {
    const fallback = await withTimeout(researchWithSearchSnippets(card, bundles), 12_000, "nightly snippets").catch(
      () => [],
    );
    collected.push(...fallback);
  }

  return collected;
}

async function researchWithSearchSnippets(
  card: ExtractedCard,
  bundles: Awaited<ReturnType<typeof collectSourceSnippets>>["bundles"],
) {
  const prompt = `Extract structured market evidence from these source-targeted web snippets for the card below.

Card JSON:
${JSON.stringify(card, null, 2)}

Detected franchise/category: ${franchiseLabel(card)}

Source snippets:
${JSON.stringify(bundles, null, 2)}

Return JSON only matching:
${MARKET_JSON_SCHEMA}

Rules:
- Use only snippet facts; do not invent prices, dates, or URLs.
- observedAt must be null unless a sale or listing date appears explicitly in the snippets for that row (not set year, not copyright).
- Label source exactly as one of: eBay, Card Ladder, ALT, PriceCharting, CardMarket, TCGPlayer.
- Mark slab as "PSA 10" or "BGS Black Label" when the snippet indicates that grade.`;

  const result = await completePlainText(MARKET_ANALYST_SYSTEM, prompt);
  if (!result.ok) return [];
  return parseMarketJson(result.text);
}

function dedupeEvidence(items: MarketEvidence[]): MarketEvidence[] {
  const seen = new Set<string>();
  const out: MarketEvidence[] = [];
  for (const item of items) {
    const key = `${item.kind}|${item.source ?? ""}|${item.title}|${item.priceUsd ?? ""}|${item.url ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function rankEvidence(items: MarketEvidence[]): MarketEvidence[] {
  const priority = (item: MarketEvidence) => {
    const sourceId = normalizeMarketSource(item.source);
    const sourceWeight =
      sourceId === "ebay"
        ? 0
        : sourceId === "cardladder"
          ? 1
          : sourceId === "alt"
            ? 2
            : sourceId === "pricecharting"
              ? 3
              : sourceId === "tcgplayer"
                ? 4
                : sourceId === "cardmarket"
                  ? 5
                  : 6;
    const kindWeight = item.kind === "sold" ? 0 : item.kind === "active" ? 1 : 2;
    const slabWeight = /psa\s*10|black label/i.test(`${item.slab ?? ""} ${item.title}`) ? 0 : 1;
    const priceWeight = item.priceUsd == null ? 1 : 0;
    return sourceWeight * 100 + kindWeight * 10 + slabWeight * 5 + priceWeight;
  };

  return [...items].sort((a, b) => priority(a) - priority(b));
}

function decorateEvidence(items: MarketEvidence[]): MarketEvidence[] {
  return items.map((item) => ({
    ...item,
    gradeBucket: item.gradeBucket ?? inferEvidenceGradeBucket(item),
    saleType: item.saleType ?? inferMarketVenueType(item),
    confidence: item.confidence ?? (item.url && item.priceUsd != null ? 0.72 : item.url ? 0.52 : 0.35),
  }));
}

export async function researchCardMarket(
  card: ExtractedCard,
  options?: { catalogId?: string | null; profile?: "scan" | "nightly" },
): Promise<{
  marketEvidence: MarketEvidence[];
  fairValueUsd: number | null;
  fairValueBasis: FairValueBasis | null;
  marketSourceLinks: ReturnType<typeof buildMarketSourceLinks>;
  institutionalMemory: boolean;
}> {
  const profile = options?.profile ?? "scan";
  const isNightly = profile === "nightly";
  const marketSourceLinks = buildMarketSourceLinks(card);
  const catalogId = options?.catalogId?.trim() || null;
  const institutional = catalogId
    ? await loadPersistedMarketEvidence(catalogId, { compLimit: 48 })
    : { evidence: [], intel: null, catalogReference: [] };
  const memoryEvidence = institutional.evidence;
  const nightlyFresh =
    isNightly &&
    isNightlyMemoryFresh(institutional.intel, getMarketNightlyMemoryFreshDays()) &&
    hasInstitutionalMarketMemory(memoryEvidence, { minSold: 5 });
  const skipHeavyLiveResearch =
    nightlyFresh ||
    (process.env.MARKET_SKIP_LLM_WHEN_MEMORY === "1" &&
      hasInstitutionalMarketMemory(memoryEvidence, { minSold: 8 }));

  const lane = classifyCardLane(card as Record<string, unknown>).lane;
  const gradedHarvest =
    !isNightly && (lane === "graded" || card.cert)
      ? await withTimeout(harvestGradedMarketEvidence(card), 20_000, "graded harvest").catch(() => null)
      : null;

  const apiEvidence = await withTimeout(
    collectApiMarketEvidence(card),
    isNightly ? 10_000 : 15_000,
    "market api adapters",
  ).catch(() => []);

  const rawSoldForLanes = apiEvidence.filter(
    (item) => item.kind === "sold" && /ebay/i.test(item.source ?? ""),
  );
  const premiumGradeLanes = await withTimeout(
    collectPremiumGradeLanes(card, rawSoldForLanes, { minRows: 1 }),
    isNightly ? 22_000 : 38_000,
    "premium grade lanes",
  ).catch(() => []);

  const { bundles, heuristicEvidence } = await withTimeout(
    collectSourceSnippets(card),
    isNightly ? 12_000 : 20_000,
    "market snippet collection",
  ).catch(() => ({ bundles: [], heuristicEvidence: [], queries: buildMarketQueries(card) }));

  const evidence: MarketEvidence[] = [
    ...memoryEvidence,
    ...apiEvidence,
    ...premiumGradeLanes,
    ...(gradedHarvest?.evidence ?? []),
    ...heuristicEvidence,
  ];

  if (!skipHeavyLiveResearch) {
    if (isNightly) {
      const nightlyAi = await collectNightlyAiEvidence(card, bundles);
      evidence.push(...nightlyAi);
    } else {
      let soldFromAi = 0;
      for (const provider of getMarketScanAiOrder()) {
        if (soldFromAi >= 3) break;
        if (provider === "groq" && getGroqApiKey() && !isAiResearchInCooldown("groq")) {
          const rows = await withTimeout(
            researchWithGroqCompound(card, bundles),
            20_000,
            "groq market research",
          ).catch(() => []);
          evidence.push(...rows);
          soldFromAi = rows.filter((r) => r.kind === "sold" && r.priceUsd != null).length;
          continue;
        }
        if (provider === "gemini" && isGeminiServiceEnabled() && !isAiResearchInCooldown("gemini")) {
          const rows = await withTimeout(
            researchWithGemini(card, bundles),
            22_000,
            "gemini market research",
          ).catch(() => []);
          evidence.push(...rows);
          soldFromAi = Math.max(
            soldFromAi,
            rows.filter((r) => r.kind === "sold" && r.priceUsd != null).length,
          );
        }
      }
      if (soldFromAi < 2) {
        const snippets = await withTimeout(
          researchWithSearchSnippets(card, bundles),
          18_000,
          "market text extraction",
        ).catch(() => []);
        evidence.push(...snippets);
      }
    }
  }

  const identityScopedEvidence = filterMarketEvidenceForCardIdentity(
    dedupeEvidence(sanitizeEvidenceList(evidence)),
    card,
  );
  const marketEvidence = decorateEvidence(rankEvidence(identityScopedEvidence).slice(0, 48));
  const { fairValueUsd, fairValueBasis } = deriveFairValueResult(marketEvidence, {
    card,
    gradeCard: card,
    stickerUsd: typeof card.extractedPrice === "number" ? card.extractedPrice : null,
    targetGradeBucket: inferCardTargetGradeBucket(card),
  });
  return {
    marketEvidence,
    fairValueUsd,
    fairValueBasis,
    marketSourceLinks,
    institutionalMemory: hasInstitutionalMarketMemory(marketEvidence, { minSold: 6 }),
  };
}
