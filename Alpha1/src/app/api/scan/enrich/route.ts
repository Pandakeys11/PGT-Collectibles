import { NextRequest, NextResponse } from "next/server";
import { enrichCacheKey, getEnrichMarketCache, setEnrichMarketCache } from "@/lib/market/enrich-cache";
import { matchCatalogForEnrich } from "@/lib/market/catalog-router";
import { hydrateRegistryFromCard } from "@/lib/market/hydrate-registry-from-card";
import { researchCardMarket } from "@/lib/market/research";
import {
  catalogMatchIsAuthoritative,
  mergeExtractedCardWithCatalog,
  resolveCatalogImageUrl,
} from "@/lib/scan/catalog-merge";
import { buildScanCardContext } from "@/lib/scan/context-builder";
import { mergeRegistrySlabIntoCard, normalizeGradedSlabFields } from "@/lib/scan/graded-slab";
import { classifyCardLane } from "@/lib/scan/lane";
import type { ExtractedCard, MarketEvidence } from "@/lib/scan/schemas";
import { catalogCandidateSchema, extractedCardSchema, identityEvidenceSchema } from "@/lib/scan/schemas";
import { syncCurrentAppUser } from "@/lib/auth/app-user";

export const maxDuration = 300;

type EnrichPhase = "full" | "catalog" | "market";

const EMPTY_REGISTRY = {
  registry: null,
  populationSummary: null,
  provider: null,
  gradeDate: null,
  gemrateId: null,
  certMarketEvidence: [] as MarketEvidence[],
  fromCache: false,
  pgtCardIdentityId: null,
};

async function registryHydrationForCard(
  card: ExtractedCard,
  skipRegistry: boolean,
  userId: string | null,
) {
  const lane = classifyCardLane(card as Record<string, unknown>).lane;
  if (lane !== "graded" || skipRegistry) return EMPTY_REGISTRY;
  return hydrateRegistryFromCard(card, {
    includeCertMarket: !skipRegistry,
    persist: true,
    userId,
  });
}

function mergeCertIntoMarketEvidence(
  base: MarketEvidence[],
  certRows: MarketEvidence[],
): MarketEvidence[] {
  if (!certRows.length) return base;
  const seen = new Set<string>();
  const out = [...certRows, ...base];
  return out.filter((it) => {
    const key = `${it.kind}|${it.url ?? ""}|${it.title}|${it.priceUsd ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function POST(req: NextRequest) {
  let body: {
    specimenId?: string;
    card?: unknown;
    skipCache?: boolean;
    skipRegistry?: boolean;
    phase?: string;
    catalogId?: string | null;
    catalogImageUrl?: string | null;
    catalogIdentityStatus?: string;
    catalogConfidence?: number;
    catalogCandidates?: unknown;
    identityEvidence?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const phase: EnrichPhase =
    body.phase === "catalog" || body.phase === "market" ? body.phase : "full";

  const specimenId = String(body.specimenId ?? "").trim();
  if (!specimenId) {
    return NextResponse.json({ error: "specimenId required" }, { status: 400 });
  }

  const parsedCard = extractedCardSchema.safeParse(body.card);
  if (!parsedCard.success) {
    return NextResponse.json({ error: "Invalid card payload" }, { status: 400 });
  }

  const inputCard = normalizeGradedSlabFields(parsedCard.data);
  const skipRegistry = body.skipRegistry === true;
  const appUser = skipRegistry ? null : await syncCurrentAppUser();
  const userId = appUser?.id ?? null;

  if (phase === "market") {
    const skipCache = body.skipCache === true;
    const cacheKey = enrichCacheKey(inputCard);
    let market = skipCache ? null : getEnrichMarketCache(cacheKey);
    if (!market) {
      market = await researchCardMarket(inputCard);
      if (!skipCache) setEnrichMarketCache(cacheKey, market);
    }

    const catalogId = typeof body.catalogId === "string" && body.catalogId.trim() ? body.catalogId.trim() : null;
    const catalogImageUrl =
      typeof body.catalogImageUrl === "string" && body.catalogImageUrl.trim()
        ? body.catalogImageUrl.trim()
        : null;
    const catalogIdentityStatus =
      body.catalogIdentityStatus === "confirmed" ||
      body.catalogIdentityStatus === "likely" ||
      body.catalogIdentityStatus === "ambiguous" ||
      body.catalogIdentityStatus === "failed"
        ? body.catalogIdentityStatus
        : catalogId
          ? "confirmed"
          : undefined;
    const catalogConfidence =
      typeof body.catalogConfidence === "number" && Number.isFinite(body.catalogConfidence)
        ? body.catalogConfidence
        : undefined;
    const catalogCandidatesParsed = catalogCandidateSchema.array().safeParse(body.catalogCandidates);
    const catalogCandidates = catalogCandidatesParsed.success ? catalogCandidatesParsed.data : undefined;
    const identityEvidenceParsed = identityEvidenceSchema.array().safeParse(body.identityEvidence);
    const identityEvidence = identityEvidenceParsed.success ? identityEvidenceParsed.data : undefined;

    const reg = await registryHydrationForCard(inputCard, skipRegistry, userId);
    const cardOut = skipRegistry ? inputCard : mergeRegistrySlabIntoCard(inputCard, reg.registry);
    const marketEvidence = mergeCertIntoMarketEvidence(
      market.marketEvidence,
      reg.certMarketEvidence,
    );
    const context = buildScanCardContext({
      specimenId,
      card: cardOut,
      registry: reg.registry,
      populationSummary: reg.populationSummary,
      certProvider: reg.provider,
      certGradeDate: reg.gradeDate,
      certMarketEvidence: reg.certMarketEvidence,
      catalogId,
      year: cardOut.year ?? null,
      catalogImageUrl,
      catalogIdentityStatus,
      catalogConfidence,
      catalogCandidates,
      identityEvidence,
      marketEvidence,
      marketSourceLinks: market.marketSourceLinks,
      fairValueUsd: market.fairValueUsd,
      fairValueBasis: market.fairValueBasis,
    });

    return NextResponse.json({
      card: cardOut,
      context,
      catalogMatched: Boolean(catalogId),
      catalogId,
    });
  }

  const catalog = await matchCatalogForEnrich(inputCard);
  const mergedCard = mergeExtractedCardWithCatalog(inputCard, catalog);
  const authoritativeCatalog = catalogMatchIsAuthoritative(catalog, mergedCard);
  const resolvedCatalogImageUrl = resolveCatalogImageUrl(catalog, mergedCard);

  if (phase === "catalog") {
    const context = buildScanCardContext({
      specimenId,
      card: mergedCard,
      catalogId: authoritativeCatalog ? (catalog?.catalogId ?? null) : null,
      year: mergedCard.year ?? (authoritativeCatalog ? (catalog?.year ?? null) : null),
      catalogImageUrl: resolvedCatalogImageUrl,
      catalogIdentityStatus: catalog?.catalogIdentityStatus ?? "failed",
      catalogConfidence: catalog?.catalogConfidence ?? 0,
      catalogCandidates: catalog?.candidates ?? [],
      identityEvidence: catalog?.identityEvidence ?? [],
      marketEvidence: [],
      marketSourceLinks: [],
      fairValueUsd: null,
      fairValueBasis: null,
    });

    return NextResponse.json({
      card: mergedCard,
      context,
      catalogMatched: authoritativeCatalog,
      catalogId: authoritativeCatalog ? (catalog?.catalogId ?? null) : null,
    });
  }

  const skipCache = body.skipCache === true;
  const cacheKey = enrichCacheKey(mergedCard);
  let market = skipCache ? null : getEnrichMarketCache(cacheKey);
  if (!market) {
    market = await researchCardMarket(mergedCard);
    if (!skipCache) setEnrichMarketCache(cacheKey, market);
  }

  const reg = await registryHydrationForCard(mergedCard, skipRegistry, userId);
  const cardOut = skipRegistry ? mergedCard : mergeRegistrySlabIntoCard(mergedCard, reg.registry);
  const marketEvidence = mergeCertIntoMarketEvidence(
    market.marketEvidence,
    reg.certMarketEvidence,
  );
  const context = buildScanCardContext({
    specimenId,
    card: cardOut,
    registry: reg.registry,
    populationSummary: reg.populationSummary,
    certProvider: reg.provider,
    certGradeDate: reg.gradeDate,
    certMarketEvidence: reg.certMarketEvidence,
    catalogId: authoritativeCatalog ? (catalog?.catalogId ?? null) : null,
    year: mergedCard.year ?? (authoritativeCatalog ? (catalog?.year ?? null) : null),
    catalogImageUrl: resolvedCatalogImageUrl,
    catalogIdentityStatus: catalog?.catalogIdentityStatus ?? "failed",
    catalogConfidence: catalog?.catalogConfidence ?? 0,
    catalogCandidates: catalog?.candidates ?? [],
    identityEvidence: catalog?.identityEvidence ?? [],
    marketEvidence,
    marketSourceLinks: market.marketSourceLinks,
    fairValueUsd: market.fairValueUsd,
    fairValueBasis: market.fairValueBasis,
  });

  return NextResponse.json({
    card: cardOut,
    context,
    catalogMatched: authoritativeCatalog,
    catalogId: authoritativeCatalog ? (catalog?.catalogId ?? null) : null,
  });
}
