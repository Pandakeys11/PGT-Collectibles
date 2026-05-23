import { GoogleGenerativeAI } from "@google/generative-ai";
import { completePlainText } from "@/lib/ai/text";
import { getGeminiApiKey, getGeminiTextModel } from "@/lib/ai/env";
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
import type { ExtractedCard, MarketEvidence } from "@/lib/scan/schemas";

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

const MARKET_ANALYST_SYSTEM = `You are a senior trading-card and collectibles market analyst for Pokemon TCG, other TCGs (One Piece, Yu-Gi-Oh!, Magic, Lorcana, Dragon Ball), and sports cards. Pull the freshest sold comps and active asks from ${MARKET_SOURCES_LINE}.

Today's date is ${RESEARCH_TODAY_ISO} (use only for reasoning, not as a fake observedAt).

Card Ladder links: use the provided Card Ladder search URL; use \`/ladder/card/...\` only when that exact URL appears in snippets. Never invent slugs.

Return only verifiable rows with real URLs, USD prices when visible, and the correct source label.
Prioritize PSA 10 and BGS Black Label sold comps when the card is vintage, chase, or slab-relevant.

For observedAt (sale or listing date): set null unless that exact calendar date appears verbatim in the provided snippets or in grounded search result text for that row. Never invent dates, never use card set release years, copyright years, or years embedded only in URLs. Never use training-data recollection of old auctions.`;

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

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  });
  return parseMarketJson(result.response.text());
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

export async function researchCardMarket(card: ExtractedCard): Promise<{
  marketEvidence: MarketEvidence[];
  fairValueUsd: number | null;
  fairValueBasis: FairValueBasis | null;
  marketSourceLinks: ReturnType<typeof buildMarketSourceLinks>;
}> {
  const marketSourceLinks = buildMarketSourceLinks(card);
  const lane = classifyCardLane(card as Record<string, unknown>).lane;
  const gradedHarvest =
    lane === "graded" || card.cert
      ? await withTimeout(harvestGradedMarketEvidence(card), 20_000, "graded harvest").catch(() => null)
      : null;

  const apiEvidence = await withTimeout(collectApiMarketEvidence(card), 15_000, "market api adapters").catch(
    () => [],
  );
  const { bundles, heuristicEvidence } = await withTimeout(
    collectSourceSnippets(card),
    20_000,
    "market snippet collection",
  ).catch(() => ({ bundles: [], heuristicEvidence: [], queries: buildMarketQueries(card) }));

  const evidence: MarketEvidence[] = [
    ...apiEvidence,
    ...(gradedHarvest?.evidence ?? []),
    ...heuristicEvidence,
  ];
  const tasks: Promise<MarketEvidence[]>[] = [];

  if (getGeminiApiKey()) {
    tasks.push(
      withTimeout(researchWithGemini(card, bundles), 22_000, "gemini market research").catch(() => []),
    );
  }
  tasks.push(withTimeout(researchWithSearchSnippets(card, bundles), 18_000, "market text extraction").catch(() => []));

  const chunks = await Promise.all(tasks);
  for (const chunk of chunks) {
    evidence.push(...chunk);
  }

  const marketEvidence = decorateEvidence(rankEvidence(dedupeEvidence(sanitizeEvidenceList(evidence))).slice(0, 36));
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
  };
}
