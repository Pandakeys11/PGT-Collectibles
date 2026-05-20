import { NextRequest, NextResponse } from "next/server";
import { enrichCacheKey, getEnrichMarketCache, setEnrichMarketCache } from "@/lib/market/enrich-cache";
import { matchPokemonCatalog } from "@/lib/market/pokemon-catalog";
import { researchCardMarket } from "@/lib/market/research";
import { catalogMatchIsAuthoritative, mergeExtractedCardWithCatalog } from "@/lib/scan/catalog-merge";
import { buildScanCardContext } from "@/lib/scan/context-builder";
import { extractedCardSchema } from "@/lib/scan/schemas";

export const maxDuration = 300;

type EnrichPhase = "full" | "catalog" | "market";

export async function POST(req: NextRequest) {
  let body: {
    specimenId?: string;
    card?: unknown;
    skipCache?: boolean;
    phase?: string;
    catalogId?: string | null;
    catalogImageUrl?: string | null;
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

  if (phase === "market") {
    const skipCache = body.skipCache === true;
    const cacheKey = enrichCacheKey(parsedCard.data);
    let market = skipCache ? null : getEnrichMarketCache(cacheKey);
    if (!market) {
      market = await researchCardMarket(parsedCard.data);
      if (!skipCache) setEnrichMarketCache(cacheKey, market);
    }

    const catalogId = typeof body.catalogId === "string" && body.catalogId.trim() ? body.catalogId.trim() : null;
    const catalogImageUrl =
      typeof body.catalogImageUrl === "string" && body.catalogImageUrl.trim()
        ? body.catalogImageUrl.trim()
        : null;

    const context = buildScanCardContext({
      specimenId,
      card: parsedCard.data,
      catalogId,
      year: parsedCard.data.year ?? null,
      catalogImageUrl,
      marketEvidence: market.marketEvidence,
      marketSourceLinks: market.marketSourceLinks,
      fairValueUsd: market.fairValueUsd,
      fairValueBasis: market.fairValueBasis,
    });

    return NextResponse.json({
      card: parsedCard.data,
      context,
      catalogMatched: Boolean(catalogId),
      catalogId,
    });
  }

  const catalog = await matchPokemonCatalog(parsedCard.data);
  const mergedCard = mergeExtractedCardWithCatalog(parsedCard.data, catalog);
  const authoritativeCatalog = catalogMatchIsAuthoritative(catalog);
  const resolvedCatalogImageUrl =
    authoritativeCatalog ? (catalog?.imageSmallUrl ?? catalog?.imageLargeUrl ?? catalog?.imageUrl ?? null) : null;

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
    marketEvidence: market.marketEvidence,
    marketSourceLinks: market.marketSourceLinks,
    fairValueUsd: market.fairValueUsd,
    fairValueBasis: market.fairValueBasis,
  });

  return NextResponse.json({
    card: mergedCard,
    context,
    catalogMatched: authoritativeCatalog,
    catalogId: authoritativeCatalog ? (catalog?.catalogId ?? null) : null,
  });
}
