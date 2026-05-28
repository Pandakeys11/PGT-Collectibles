import { NextRequest, NextResponse } from "next/server";
import { enrichCacheKey, getEnrichMarketCache, setEnrichMarketCache } from "@/lib/market/enrich-cache";
import { resolveLocalizedCatalogArtwork } from "@/lib/catalog/localized-artwork";
import { ensureCatalogMatchOptions } from "@/lib/market/ensure-catalog-options";
import {
  hydrateRegistryFromCard,
  type RegistryHydration,
} from "@/lib/market/hydrate-registry-from-card";
import { researchCardMarket } from "@/lib/market/research";
import { persistMarketIntelFromEnrich } from "@/lib/pgt-registry/pgt-market-intel-persist";
import {
  mergeExtractedCardWithCatalog,
  resolveCatalogImageUrl,
  resolveCatalogPreviewImageUrl,
  trustedCatalogMatch,
} from "@/lib/scan/catalog-merge";
import { buildScanCardContext } from "@/lib/scan/context-builder";
import {
  buildCatalogEnrichTelemetry,
  logCatalogEnrichTelemetry,
} from "@/lib/scan/enrich-telemetry";
import {
  hasReadableCertNumber,
  mergeRegistrySlabIntoCard,
  normalizeGradedSlabFields,
} from "@/lib/scan/graded-slab";
import { normalizeJapanesePokemonIdentity } from "@/lib/scan/japanese-pokemon";
import { classifyCardLane } from "@/lib/scan/lane";
import type { ExtractedCard, MarketEvidence } from "@/lib/scan/schemas";
import { catalogCandidateSchema, extractedCardSchema, identityEvidenceSchema } from "@/lib/scan/schemas";
import { syncCurrentAppUser } from "@/lib/auth/app-user";

export const maxDuration = 300;

type EnrichPhase = "full" | "catalog" | "market";

const EMPTY_REGISTRY: RegistryHydration = {
  registry: null,
  populationSummary: null,
  provider: null,
  gradeDate: null,
  gemrateId: null,
  certMarketEvidence: [],
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
    catalogImageSource?: string | null;
    catalogImageSourceLabel?: string | null;
    catalogImageNeedsReview?: boolean;
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

  const inputCard = normalizeJapanesePokemonIdentity(normalizeGradedSlabFields(parsedCard.data));
  const skipRegistry = body.skipRegistry === true;
  const appUser = skipRegistry ? null : await syncCurrentAppUser();
  const userId = appUser?.id ?? null;

  if (phase === "market") {
    const catalogId =
      typeof body.catalogId === "string" && body.catalogId.trim() ? body.catalogId.trim() : null;
    const skipCache = body.skipCache === true;
    const cacheKey = enrichCacheKey(inputCard);
    let market = skipCache ? null : getEnrichMarketCache(cacheKey);
    if (!market) {
      market = await researchCardMarket(inputCard, { catalogId });
      if (!skipCache) setEnrichMarketCache(cacheKey, market);
    }
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
      catalogImageSource:
        body.catalogImageSource === "exact_japanese_print" ||
        body.catalogImageSource === "same_art_confirmed" ||
        body.catalogImageSource === "english_fallback" ||
        body.catalogImageSource === "needs_image_review"
          ? body.catalogImageSource
          : null,
      catalogImageSourceLabel:
        typeof body.catalogImageSourceLabel === "string"
          ? body.catalogImageSourceLabel
          : null,
      catalogImageNeedsReview: body.catalogImageNeedsReview === true,
      catalogIdentityStatus,
      catalogConfidence,
      catalogCandidates,
      identityEvidence,
      marketEvidence,
      marketSourceLinks: market.marketSourceLinks,
      fairValueUsd: market.fairValueUsd,
      fairValueBasis: market.fairValueBasis,
    });

    if (catalogId) {
      void persistMarketIntelFromEnrich({
        catalogId,
        card: cardOut,
        marketEvidence,
        pgtCardIdentityId: reg.pgtCardIdentityId,
      }).catch(() => null);
    }

    return NextResponse.json({
      card: cardOut,
      context,
      catalogMatched: Boolean(catalogId),
      catalogId,
    });
  }

  const lane = classifyCardLane(inputCard as Record<string, unknown>).lane;
  let catalogInput = inputCard;
  let preCatalogRegistry: RegistryHydration = EMPTY_REGISTRY;
  if (lane === "graded" && hasReadableCertNumber(inputCard.cert) && !skipRegistry) {
    preCatalogRegistry = await registryHydrationForCard(inputCard, false, userId);
    catalogInput = mergeRegistrySlabIntoCard(inputCard, preCatalogRegistry.registry);
    const registryName = preCatalogRegistry.registry?.cardName?.trim();
    if (
      registryName &&
      (!catalogInput.name?.trim() || /^unknown|resolving/i.test(catalogInput.name))
    ) {
      catalogInput = extractedCardSchema.parse({ ...catalogInput, name: registryName });
    }
  }

  const catalog = await ensureCatalogMatchOptions(catalogInput);
  logCatalogEnrichTelemetry(
    buildCatalogEnrichTelemetry(specimenId, catalogInput, catalog),
  );
  const mergedCard = mergeExtractedCardWithCatalog(catalogInput, catalog);
  const catalogTrusted = trustedCatalogMatch(catalog, mergedCard);
  const catalogIdLocked =
    catalogTrusted
      ? (catalog?.catalogId ?? catalog?.candidates[0]?.catalogId ?? null)
      : null;
  const resolvedCatalogImageUrl =
    resolveCatalogImageUrl(catalog, mergedCard) ??
    resolveCatalogPreviewImageUrl(catalog, mergedCard);
  const localizedArtwork = await resolveLocalizedCatalogArtwork({
    card: mergedCard,
    catalog,
    fallbackImageUrl: resolvedCatalogImageUrl,
  });
  const finalCatalogImageUrl =
    localizedArtwork?.imageSmallUrl ??
    localizedArtwork?.imageLargeUrl ??
    resolvedCatalogImageUrl;

  if (phase === "catalog") {
    const context = buildScanCardContext({
      specimenId,
      card: mergedCard,
      registry: preCatalogRegistry.registry,
      populationSummary: preCatalogRegistry.populationSummary,
      certProvider: preCatalogRegistry.provider,
      certGradeDate: preCatalogRegistry.gradeDate,
      certMarketEvidence: preCatalogRegistry.certMarketEvidence,
      catalogId: catalogIdLocked,
      year: mergedCard.year ?? (catalogTrusted ? (catalog?.year ?? null) : null),
      catalogImageUrl: finalCatalogImageUrl,
      catalogImageSource: localizedArtwork?.status ?? null,
      catalogImageSourceLabel: localizedArtwork?.sourceLabel ?? null,
      catalogImageNeedsReview: localizedArtwork?.needsReview ?? false,
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
      catalogMatched: catalogTrusted,
      catalogId: catalogIdLocked,
    });
  }

  const skipCache = body.skipCache === true;
  const cacheKey = enrichCacheKey(mergedCard);
  let market = skipCache ? null : getEnrichMarketCache(cacheKey);
  if (!market) {
    market = await researchCardMarket(mergedCard, { catalogId: catalogIdLocked });
    if (!skipCache) setEnrichMarketCache(cacheKey, market);
  }

  const reg =
    preCatalogRegistry.registry != null
      ? preCatalogRegistry
      : await registryHydrationForCard(mergedCard, skipRegistry, userId);
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
    catalogId: catalogIdLocked,
    year: mergedCard.year ?? (catalogTrusted ? (catalog?.year ?? null) : null),
    catalogImageUrl: finalCatalogImageUrl,
    catalogImageSource: localizedArtwork?.status ?? null,
    catalogImageSourceLabel: localizedArtwork?.sourceLabel ?? null,
    catalogImageNeedsReview: localizedArtwork?.needsReview ?? false,
    catalogIdentityStatus: catalog?.catalogIdentityStatus ?? "failed",
    catalogConfidence: catalog?.catalogConfidence ?? 0,
    catalogCandidates: catalog?.candidates ?? [],
    identityEvidence: catalog?.identityEvidence ?? [],
    marketEvidence,
    marketSourceLinks: market.marketSourceLinks,
    fairValueUsd: market.fairValueUsd,
    fairValueBasis: market.fairValueBasis,
  });

  const catalogIdForIntel =
    catalogIdLocked ??
    (typeof body.catalogId === "string" && body.catalogId.trim() ? body.catalogId.trim() : null);

  if (catalogIdForIntel) {
    void persistMarketIntelFromEnrich({
      catalogId: catalogIdForIntel,
      card: cardOut,
      marketEvidence,
      pgtCardIdentityId: reg.pgtCardIdentityId,
    }).catch(() => null);
  }

  return NextResponse.json({
    card: cardOut,
    context,
    catalogMatched: catalogTrusted,
    catalogId: catalogIdLocked,
  });
}
