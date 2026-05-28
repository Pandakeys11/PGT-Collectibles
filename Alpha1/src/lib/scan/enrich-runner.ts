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
import {
  buildScanCardContext,
  type CatalogContextSnapshot,
} from "@/lib/scan/context-builder";
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
import type { ExtractedCard, MarketEvidence, ScanCardContext } from "@/lib/scan/schemas";
import { extractedCardSchema } from "@/lib/scan/schemas";
import {
  persistCertCatalogBinding,
  readCachedCertCatalogId,
} from "@/lib/pgt-registry/cert-catalog-cache";

export type EnrichPhase = "full" | "catalog" | "market";

export type RunEnrichInput = {
  specimenId: string;
  card: ExtractedCard;
  phase: EnrichPhase;
  skipCache?: boolean;
  skipRegistry?: boolean;
  userId?: string | null;
} & Partial<CatalogContextSnapshot>;

export type EnrichRunResult = {
  card: ExtractedCard;
  context: ScanCardContext;
  catalogMatched: boolean;
  catalogId: string | null;
};

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

function normalizeInputCard(card: ExtractedCard): ExtractedCard {
  return normalizeJapanesePokemonIdentity(normalizeGradedSlabFields(card));
}

/** Shared catalog / market / full enrich logic (single specimen). */
export async function runEnrichForSpecimen(
  input: RunEnrichInput,
): Promise<EnrichRunResult> {
  const specimenId = input.specimenId.trim();
  if (!specimenId) throw new Error("specimenId required");

  const inputCard = normalizeInputCard(input.card);
  const skipRegistry = input.skipRegistry === true;
  const userId = input.userId ?? null;
  const phase = input.phase;

  if (phase === "market") {
    const catalogId = input.catalogId?.trim() || null;
    const skipCache = input.skipCache === true;
    const cacheKey = enrichCacheKey(inputCard);
    let market = skipCache ? null : getEnrichMarketCache(cacheKey);
    if (!market) {
      market = await researchCardMarket(inputCard, { catalogId });
      if (!skipCache) setEnrichMarketCache(cacheKey, market);
    }

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
      catalogImageUrl: input.catalogImageUrl ?? null,
      catalogImageSource: input.catalogImageSource ?? null,
      catalogImageSourceLabel: input.catalogImageSourceLabel ?? null,
      catalogImageNeedsReview: input.catalogImageNeedsReview === true,
      catalogIdentityStatus: input.catalogIdentityStatus,
      catalogConfidence: input.catalogConfidence,
      catalogCandidates: input.catalogCandidates,
      identityEvidence: input.identityEvidence,
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

    return {
      card: cardOut,
      context,
      catalogMatched: Boolean(catalogId),
      catalogId,
    };
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

  const hintCatalogId = await readCachedCertCatalogId(catalogInput);
  const catalog = await ensureCatalogMatchOptions(catalogInput, { hintCatalogId });
  logCatalogEnrichTelemetry(
    buildCatalogEnrichTelemetry(specimenId, catalogInput, catalog),
  );
  const mergedCard = mergeExtractedCardWithCatalog(catalogInput, catalog);
  const catalogTrusted = trustedCatalogMatch(catalog, mergedCard);
  const catalogIdLocked = catalogTrusted
    ? (catalog?.catalogId ?? catalog?.candidates[0]?.catalogId ?? null)
    : null;
  if (catalogIdLocked && hasReadableCertNumber(mergedCard.cert)) {
    void persistCertCatalogBinding(mergedCard, catalogIdLocked);
  }
  const resolvedCatalogImageUrl =
    resolveCatalogImageUrl(catalog, mergedCard) ??
    resolveCatalogPreviewImageUrl(catalog, mergedCard);
  const localizedArtwork = await resolveLocalizedCatalogArtwork({
    card: mergedCard,
    catalog,
    fallbackImageUrl: resolvedCatalogImageUrl,
    fastPath: phase === "catalog",
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

    return {
      card: mergedCard,
      context,
      catalogMatched: catalogTrusted,
      catalogId: catalogIdLocked,
    };
  }

  const skipCache = input.skipCache === true;
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

  if (catalogIdLocked) {
    void persistMarketIntelFromEnrich({
      catalogId: catalogIdLocked,
      card: cardOut,
      marketEvidence,
      pgtCardIdentityId: reg.pgtCardIdentityId,
    }).catch(() => null);
  }

  return {
    card: cardOut,
    context,
    catalogMatched: catalogTrusted,
    catalogId: catalogIdLocked,
  };
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const limit = Math.max(1, Math.min(concurrency, items.length));
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) break;
      results[index] = await fn(items[index]!, index);
    }
  }

  await Promise.all(Array.from({ length: limit }, () => worker()));
  return results;
}
