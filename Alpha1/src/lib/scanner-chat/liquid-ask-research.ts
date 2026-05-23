import { GoogleGenerativeAI } from "@google/generative-ai";
import { getGeminiApiKey, getGeminiTextModel } from "@/lib/ai/env";
import { withTimeout } from "@/lib/async-timeout";
import { parseCertRefsFromText, type ParsedCertRef } from "@/lib/market/cert-lookup";
import { lookupCertViaProviders } from "@/lib/market/cert-data-providers";
import { harvestGradedMarketEvidence } from "@/lib/market/graded-sales-harvest";
import { researchCardMarket } from "@/lib/market/research";
import { searchWeb } from "@/lib/market/web-search";
import { filterEvidenceByPrintEdition } from "@/lib/scan/print-edition";
import type { ExtractedCard, MarketEvidence, ScanCardContext } from "@/lib/scan/schemas";
import { shouldRunLiveResearch } from "@/lib/scanner-chat/liquid-ask-intent";
import { resolveLiquidAskResearchTier } from "@/lib/scanner-chat/liquid-ask-research-tier";
import {
  isLiquidAskFreeWebBriefConfigured,
  isLiquidAskProWebBriefConfigured,
  runLiquidAskFreeWebBrief,
  runLiquidAskProWebBrief,
} from "@/lib/scanner-chat/liquid-ask-web-brief";
import { countCompsBySource, sortCompsForDisplay } from "@/lib/scanner-chat/prioritize-comps";
import { buildGradedHubLinks } from "@/lib/market/graded-hub-urls";
import { isLiquidAskGeminiResearchEnabled } from "@/lib/ai/env";
import { getMarketCapabilities } from "@/lib/market/market-capabilities";
import type {
  LiquidAskCertLookup,
  LiquidAskComp,
  LiquidAskResearch,
  LiquidAskSource,
} from "@/lib/scanner-chat/liquid-ask-types";

const RESEARCH_TODAY_ISO = new Date().toISOString().slice(0, 10);

function evidenceToComp(
  item: MarketEvidence,
  imageUrl?: string | null,
): LiquidAskComp {
  return {
    kind: item.kind,
    title: item.title,
    priceUsd: item.priceUsd,
    observedAt: item.observedAt,
    url: item.url,
    source: item.source ?? null,
    slab: item.slab ?? null,
    imageUrl: imageUrl ?? null,
  };
}

function mergeComps(existing: LiquidAskComp[], incoming: LiquidAskComp[], max = 16): LiquidAskComp[] {
  const seen = new Set<string>();
  const out: LiquidAskComp[] = [];
  for (const row of [...existing, ...incoming]) {
    const key = `${row.kind}|${row.url ?? ""}|${row.title}|${row.priceUsd ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
    if (out.length >= max) break;
  }
  return out.sort((a, b) => {
    const kind = (k: LiquidAskComp["kind"]) => (k === "sold" ? 0 : k === "active" ? 1 : 2);
    return kind(a.kind) - kind(b.kind);
  });
}

function extractionToCard(extraction: ScanCardContext["extraction"]): ExtractedCard | null {
  if (!extraction || typeof extraction !== "object") return null;
  const name = typeof extraction.name === "string" ? extraction.name.trim() : "";
  if (!name) return null;
  return {
    name,
    set: typeof extraction.set === "string" ? extraction.set : undefined,
    number: typeof extraction.number === "string" ? extraction.number : undefined,
    year: typeof extraction.year === "string" ? extraction.year : undefined,
    grader: typeof extraction.grader === "string" ? extraction.grader : undefined,
    grade: typeof extraction.grade === "string" ? extraction.grade : undefined,
    cert: typeof extraction.cert === "string" ? extraction.cert : undefined,
    printStamps: typeof extraction.printStamps === "string" ? extraction.printStamps : undefined,
    details: typeof extraction.details === "string" ? extraction.details : undefined,
    rarity: typeof extraction.rarity === "string" ? extraction.rarity : undefined,
    franchise: typeof extraction.franchise === "string" ? extraction.franchise : undefined,
  };
}

function cardFromCertLookup(lookup: LiquidAskCertLookup): ExtractedCard | null {
  if (!lookup.cardName) return null;
  return {
    name: lookup.cardName,
    grader: lookup.grader,
    grade: lookup.grade ?? undefined,
    cert: lookup.cert,
  };
}

function sessionEvidenceFromContexts(
  contexts: ScanCardContext[],
  focusSpecimenId?: string | null,
): { comps: LiquidAskComp[]; imageBySpecimen: Map<string, string | null> } {
  const imageBySpecimen = new Map<string, string | null>();
  const comps: LiquidAskComp[] = [];
  const ordered =
    focusSpecimenId != null
      ? [
          ...contexts.filter((c) => c.specimenId === focusSpecimenId),
          ...contexts.filter((c) => c.specimenId !== focusSpecimenId),
        ]
      : contexts;

  for (const ctx of ordered.slice(0, 8)) {
    imageBySpecimen.set(ctx.specimenId, ctx.catalogImageUrl ?? null);
    const card = extractionToCard(ctx.extraction);
    const scoped = card
      ? filterEvidenceByPrintEdition(ctx.marketEvidence, card)
      : ctx.marketEvidence;
    for (const row of scoped.slice(0, 10)) {
      comps.push(evidenceToComp(row, ctx.catalogImageUrl));
    }
  }
  return { comps, imageBySpecimen };
}

async function researchQuestionOnWeb(message: string, card: ExtractedCard | null): Promise<{
  comps: LiquidAskComp[];
  sources: LiquidAskSource[];
  webNotes: string[];
}> {
  const comps: LiquidAskComp[] = [];
  const sources: LiquidAskSource[] = [];
  const webNotes: string[] = [];

  const queryParts = [message.slice(0, 220)];
  if (card?.name) {
    for (const part of [card.name, card.set, card.grader, card.grade, card.cert]) {
      if (part?.trim()) queryParts.push(part.trim());
    }
  }
  const query = queryParts.join(" ").replace(/\s+/g, " ").trim();
  const rankingQ = /\b(highest|top|most valuable|best card|grail|chase)\b/i.test(message);
  const searchQuery = rankingQ
    ? `${query} most valuable card price ${RESEARCH_TODAY_ISO}`
    : `${query} sold price market ${RESEARCH_TODAY_ISO}`;

  let results: Awaited<ReturnType<typeof searchWeb>> = [];
  try {
    results = await searchWeb(searchQuery, 8);
    if (results.length < 3 && rankingQ) {
      const extra = await searchWeb(`${query} PSA 10 sale ${RESEARCH_TODAY_ISO}`, 6);
      results = [...results, ...extra].slice(0, 10);
    }
  } catch {
    results = [];
  }
  for (const row of results) {
    sources.push({ label: row.title, url: row.url, snippet: row.snippet });
    const priceMatch = row.snippet.match(/\$\s?([\d,]+(?:\.\d{2})?)/);
    const priceUsd = priceMatch
      ? Number(priceMatch[1].replace(/,/g, ""))
      : null;
    const kind: LiquidAskComp["kind"] =
      /sold|completed|auction/i.test(`${row.title} ${row.snippet}`)
        ? "sold"
        : /listed|asking|buy it now/i.test(row.snippet)
          ? "active"
          : "reference";
    comps.push({
      kind,
      title: row.title,
      priceUsd: priceUsd != null && Number.isFinite(priceUsd) ? priceUsd : null,
      observedAt: null,
      url: row.url,
      source: row.url.includes("ebay") ? "eBay" : "Web",
      slab: card?.grader && card.grade ? `${card.grader} ${card.grade}` : null,
    });
  }

  if (results.length > 0) {
    webNotes.push(`Web search (${RESEARCH_TODAY_ISO}): ${results.length} result(s) for live market context.`);
  }

  return { comps, sources, webNotes };
}

async function researchAskWithGemini(
  message: string,
  card: ExtractedCard | null,
  certLookups: LiquidAskCertLookup[],
): Promise<LiquidAskComp[]> {
  const genAI = new GoogleGenerativeAI(getGeminiApiKey()!);
  const model = genAI.getGenerativeModel({
    model: getGeminiTextModel(),
    tools: [{ googleSearch: {} }] as never,
  });

  const prompt = `Today is ${RESEARCH_TODAY_ISO}. User question: ${message}

${card ? `Card context JSON:\n${JSON.stringify(card)}` : ""}
${certLookups.length ? `Cert lookups:\n${JSON.stringify(certLookups)}` : ""}

Use Google Search grounding. Return ONLY JSON:
{
  "marketEvidence": [
    { "kind": "sold|active|reference", "title": "string", "priceUsd": number|null, "observedAt": "yyyy-mm-dd|null", "url": "https...", "source": "eBay|Card Ladder|PSA|...", "slab": "PSA 10|null" }
  ],
  "notes": ["string"]
}

Rules: real URLs only; observedAt null unless date appears in search results; prioritize exact cert and grade comps when certs provided.`;

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  });

  const text = result.response.text();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? text;
  let parsed: {
    marketEvidence?: Array<Record<string, unknown>>;
    notes?: string[];
  };
  try {
    parsed = JSON.parse(fenced) as typeof parsed;
  } catch {
    return [];
  }
  const comps: LiquidAskComp[] = [];
  if (Array.isArray(parsed.marketEvidence)) {
    for (const row of parsed.marketEvidence) {
      const kind = row.kind;
      if (kind !== "sold" && kind !== "active" && kind !== "reference") continue;
      const title = String(row.title ?? "").trim();
      if (!title) continue;
      comps.push({
        kind,
        title,
        priceUsd:
          typeof row.priceUsd === "number" && Number.isFinite(row.priceUsd)
            ? row.priceUsd
            : null,
        observedAt:
          typeof row.observedAt === "string" && row.observedAt.trim()
            ? row.observedAt.trim()
            : null,
        url: typeof row.url === "string" && row.url.startsWith("http") ? row.url : null,
        source: typeof row.source === "string" ? row.source : null,
        slab: typeof row.slab === "string" ? row.slab : null,
      });
    }
  }
  return comps;
}

export async function runLiquidAskResearch(args: {
  message: string;
  contexts: ScanCardContext[];
  focusSpecimenId?: string | null;
  proTier: boolean;
}): Promise<LiquidAskResearch> {
  const researchTier = resolveLiquidAskResearchTier(args.proTier);
  const useProMarket = researchTier === "pro";
  const researchedAt = new Date().toISOString();
  const focus =
    args.focusSpecimenId != null
      ? args.contexts.find((c) => c.specimenId === args.focusSpecimenId) ?? null
      : null;

  const certRefs: ParsedCertRef[] = [];
  const certSeen = new Set<string>();
  for (const ref of parseCertRefsFromText(args.message)) {
    const k = `${ref.grader}:${ref.cert}`;
    if (!certSeen.has(k)) {
      certSeen.add(k);
      certRefs.push(ref);
    }
  }
  if (focus) {
    const ext = extractionToCard(focus.extraction);
    if (ext?.cert) {
      const grader = ext.grader?.trim() || "PSA";
      const cert = ext.cert.replace(/\D/g, "");
      const k = `${grader}:${cert}`;
      if (!certSeen.has(k) && cert.length >= 6) {
        certSeen.add(k);
        certRefs.push({ grader: grader.toUpperCase().includes("BGS") ? "BGS" : grader.toUpperCase().includes("CGC") ? "CGC" : "PSA", cert });
      }
    }
  }

  const certLookups: LiquidAskCertLookup[] = [];
  const certSnippets: LiquidAskSource[] = [];

  const certSettled = await Promise.allSettled(
    certRefs.slice(0, 3).map((ref) => lookupCertViaProviders(ref)),
  );
  for (const row of certSettled) {
    if (row.status !== "fulfilled") continue;
    const hit = row.value;
    if (!hit?.registry) continue;
    const { registry, populationNote, gradeDate, provider } = hit;
    certLookups.push({
      grader: registry.grader ?? "PSA",
      cert: registry.certNumber ?? "",
      registryUrl: registry.registryUrl ?? "",
      cardName: registry.cardName,
      grade: registry.grade,
      populationNote,
      gradeDate,
      verified: registry.isVerified,
      dataProvider: provider,
    });
    certSnippets.push({
      label: `${provider} · ${registry.grader} #${registry.certNumber}`,
      url: registry.registryUrl ?? "",
      snippet: [registry.cardName, registry.grade, populationNote].filter(Boolean).join(" · "),
    });
  }

  const { comps: sessionComps } = sessionEvidenceFromContexts(
    args.contexts,
    args.focusSpecimenId,
  );
  let comps = sessionComps;
  const sources: LiquidAskSource[] = [...certSnippets];
  const webNotes: string[] = [];

  const focusCard = focus ? extractionToCard(focus.extraction) : null;
  const certCard = certLookups[0] ? cardFromCertLookup(certLookups[0]) : null;
  const researchCard = focusCard ?? certCard;
  const wantsLive =
    shouldRunLiveResearch(args.message, args.contexts.length) || Boolean(researchCard?.name);

  let liveResearchUsed = false;
  let webBrief: string | null = null;
  let proWebBriefUsed = false;
  let geminiBriefUsed = false;
  let proMarketSkipped = false;
  let hubLinks: LiquidAskResearch["hubLinks"] = [];
  let ebaySoldFromHarvest = 0;
  const caps = getMarketCapabilities();
  let geminiUsed = false;

  const generalQuestion = !researchCard?.name;

  if (wantsLive && generalQuestion) {
    if (useProMarket && isLiquidAskProWebBriefConfigured()) {
      try {
        const brief = await runLiquidAskProWebBrief(args.message, RESEARCH_TODAY_ISO);
        if (brief?.markdown) {
          webBrief = brief.markdown;
          proWebBriefUsed = true;
          liveResearchUsed = true;
          webNotes.push(`Pro open-web brief (${brief.model}, ${RESEARCH_TODAY_ISO}).`);
        }
      } catch {
        /* fall through to free brief */
      }
    }
    if (!webBrief && isLiquidAskGeminiResearchEnabled() && isLiquidAskFreeWebBriefConfigured()) {
      try {
        const brief = await runLiquidAskFreeWebBrief(args.message, RESEARCH_TODAY_ISO);
        if (brief?.markdown) {
          webBrief = brief.markdown;
          geminiBriefUsed = true;
          liveResearchUsed = true;
          webNotes.push(`Gemini search brief (${brief.model}, ${RESEARCH_TODAY_ISO}).`);
        }
      } catch {
        /* continue */
      }
    }
  }

  if (researchCard?.name && wantsLive && useProMarket) {
    try {
      const harvest = await withTimeout(
        harvestGradedMarketEvidence(researchCard),
        20_000,
        "liquid ask market harvest",
      );
      comps = mergeComps(
        comps,
        harvest.evidence.map((e) => evidenceToComp(e, focus?.catalogImageUrl)),
        24,
      );
      hubLinks = harvest.hubLinks.map((h) => ({
        platform: h.platform,
        label: h.label,
        url: h.url,
        lane: h.lane,
      }));
      webNotes.push(...harvest.notes);
      ebaySoldFromHarvest = harvest.evidence.filter(
        (e) => e.kind === "sold" && (e.source ?? "").toLowerCase().includes("ebay"),
      ).length;
      liveResearchUsed = true;
    } catch {
      /* continue */
    }
  }

  if (researchCard?.name) {
    const hubs = buildGradedHubLinks(researchCard, {
      registryUrl: certLookups[0]?.registryUrl ?? null,
    });
    if (hubLinks.length === 0) {
      hubLinks = hubs.map((h) => ({
        platform: h.platform,
        label: h.label,
        url: h.url,
        lane: h.lane,
      }));
    }
  }

  if (researchCard?.name && wantsLive && !useProMarket) {
    proMarketSkipped = caps.ebayConfigured;
    if (proMarketSkipped) {
      webNotes.push(
        "Automated eBay sold comps and full market enrich are Pro — using web search and Gemini grounding on this plan.",
      );
    }
  }

  const skipFullMarket = ebaySoldFromHarvest >= 4;
  if (researchCard?.name && wantsLive && useProMarket && !skipFullMarket) {
    try {
      const market = await withTimeout(
        researchCardMarket(researchCard),
        18_000,
        "liquid ask market",
      );
      liveResearchUsed = true;
      comps = mergeComps(
        comps,
        market.marketEvidence.map((e) => evidenceToComp(e, focus?.catalogImageUrl)),
        20,
      );
      for (const link of market.marketSourceLinks.slice(0, 6)) {
        if (!sources.some((s) => s.url === link.url)) {
          sources.push({ label: link.label, url: link.url });
        }
      }
      webNotes.push(`Market enrich (${RESEARCH_TODAY_ISO}): ${market.marketEvidence.length} row(s).`);
    } catch {
      /* fall through */
    }
  }

  if (wantsLive) {
    try {
      const web = await researchQuestionOnWeb(args.message, researchCard);
      comps = mergeComps(comps, web.comps);
      sources.push(...web.sources);
      webNotes.push(...web.webNotes);
      if (web.comps.length > 0 || web.sources.length > 0) liveResearchUsed = true;
    } catch {
      /* continue */
    }
  }

  if (
    isLiquidAskGeminiResearchEnabled() &&
    caps.geminiSearch &&
    ebaySoldFromHarvest < 3 &&
    !webBrief &&
    (certLookups.length > 0 || args.message.length > 20) &&
    wantsLive
  ) {
    try {
      const geminiComps = await withTimeout(
        researchAskWithGemini(args.message, researchCard, certLookups),
        22_000,
        "liquid ask gemini",
      );
      comps = mergeComps(comps, geminiComps, 24);
      geminiUsed = true;
      liveResearchUsed = true;
      webNotes.push(`Gemini comp grounding (${RESEARCH_TODAY_ISO}).`);
    } catch {
      /* optional */
    }
  }

  const compCounts = countCompsBySource(comps);
  comps = sortCompsForDisplay(comps);

  const sessionMarketAsOf = args.contexts
    .map((c) => c.marketAsOf)
    .filter(Boolean)
    .sort()
    .at(-1) ?? null;

  return {
    researchedAt,
    todayUtc: RESEARCH_TODAY_ISO,
    certLookups,
    comps,
    sources: sources.slice(0, 14),
    hubLinks,
    webNotes,
    sessionMarketAsOf,
    webBrief,
    liveResearchUsed:
      liveResearchUsed ||
      Boolean(webBrief) ||
      comps.length > 0 ||
      hubLinks.length > 0 ||
      sources.length > certSnippets.length,
    dataCoverage: {
      researchTier,
      ebayConfigured: caps.ebayConfigured,
      ebaySoldCount: compCounts.ebaySold,
      ebayActiveCount: compCounts.ebayActive,
      snippetCompCount: compCounts.snippet,
      certLookupCount: certLookups.length,
      hubsReady: hubLinks.length > 0,
      geminiUsed: geminiUsed || geminiBriefUsed,
      proWebBriefUsed,
      geminiBriefUsed,
      proMarketSkipped,
    },
  };
}

/** JSON block injected into the LLM user prompt. */
export function liquidAskResearchForLlm(research: LiquidAskResearch): string {
  return JSON.stringify(
    {
      researchedAt: research.researchedAt,
      todayUtc: research.todayUtc,
      sessionMarketAsOf: research.sessionMarketAsOf,
      certLookups: research.certLookups,
      comps: research.comps.slice(0, 14),
      sources: research.sources.slice(0, 10),
      hubLinks: research.hubLinks,
      webNotes: research.webNotes,
      webBrief: research.webBrief,
      liveResearchUsed: research.liveResearchUsed,
    },
    null,
    0,
  );
}
