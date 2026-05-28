import {
  enrichExtractedCardWithBatchFallback,
  enrichExtractedCardsBatch,
  fetchCatalogCandidates,
  type EnrichBatchItemInput,
  type EnrichBatchItemResult,
} from "@/lib/scan/enrich-client";
import { hasMinimumIdentityForCatalog } from "@/lib/scan/catalog-merge";
import { buildScanCardContext, pickCatalogContext } from "@/lib/scan/context-builder";
import {
  needsCatalogWiden,
  rowHasMarketData,
  shouldUseCombinedFullEnrich,
  type EnrichableSpecimen,
} from "@/lib/scan/enrich-specimen-utils";
import { hasReadableCertNumber } from "@/lib/scan/graded-slab";
import type { LiquidScanSpeedProfile } from "@/lib/scan/liquid-scan-speed";
import { enrichConcurrencyForCardCount } from "@/lib/scan/liquid-scan-speed";
import type { ExtractedCard, ScanCardContext } from "@/lib/scan/schemas";

export type SessionEnrichSpecimen = EnrichableSpecimen;

export type EnrichSessionPipelineOptions<T extends SessionEnrichSpecimen = SessionEnrichSpecimen> =
  {
    items: T[];
    profile: LiquidScanSpeedProfile;
    skipRegistryOnBulk: boolean;
    /** When true, catalog+widen only — caller runs market separately (faster sheet). */
    deferMarket?: boolean;
    onProgress: (message: string) => void;
    onSpecimensPatch: (updater: (current: T[]) => T[]) => void;
  };

export type MarketEnrichSessionOptions<T extends SessionEnrichSpecimen = SessionEnrichSpecimen> =
  Pick<
    EnrichSessionPipelineOptions<T>,
    "items" | "profile" | "skipRegistryOnBulk" | "onProgress" | "onSpecimensPatch"
  > & {
    /** Catalog-resolved rows keyed by specimen id (from catalog phase). */
    catalogById: Map<string, T>;
  };

function skipRegistryFor(
  specimen: SessionEnrichSpecimen,
  skipRegistryOnBulk: boolean,
): boolean {
  return (
    skipRegistryOnBulk &&
    !(specimen.context.lane === "graded" && hasReadableCertNumber(specimen.card.cert))
  );
}

function applyEnrichSuccess<T extends SessionEnrichSpecimen>(
  specimen: T,
  card: ExtractedCard,
  context: ScanCardContext,
  preserveCatalog?: ReturnType<typeof pickCatalogContext>,
): T {
  const catalogCtx = preserveCatalog ?? pickCatalogContext(context);
  return {
    ...specimen,
    card,
    context: {
      ...context,
      ...catalogCtx,
      catalogId: catalogCtx.catalogId ?? context.catalogId,
      catalogImageUrl: catalogCtx.catalogImageUrl ?? context.catalogImageUrl,
    },
  };
}

async function recoverCatalogFromCandidates<T extends SessionEnrichSpecimen>(
  specimen: T,
): Promise<T | null> {
  if (!hasMinimumIdentityForCatalog(specimen.card)) return null;
  try {
    const fallback = await fetchCatalogCandidates({
      card: specimen.card,
      existingCandidates: specimen.context.catalogCandidates,
    });
    return {
      ...specimen,
      context: buildScanCardContext({
        specimenId: specimen.id,
        card: specimen.card,
        catalogId: fallback.catalogId,
        catalogIdentityStatus: fallback.catalogIdentityStatus,
        catalogConfidence: fallback.catalogConfidence,
        catalogCandidates: fallback.candidates,
        identityEvidence: fallback.identityEvidence,
        catalogImageUrl: fallback.catalogImageUrl,
        catalogImageSource: fallback.catalogImageSource ?? null,
        catalogImageSourceLabel: fallback.catalogImageSourceLabel ?? null,
        catalogImageNeedsReview: fallback.catalogImageNeedsReview ?? false,
        marketEvidence: specimen.context.marketEvidence,
        marketSourceLinks: specimen.context.marketSourceLinks,
        fairValueUsd: specimen.context.fairValueUsd,
        fairValueBasis: specimen.context.fairValueBasis,
        year: specimen.card.year ?? specimen.context.year,
      }),
    };
  } catch {
    return null;
  }
}

async function mergeBatchResults<T extends SessionEnrichSpecimen>(
  specimens: T[],
  results: EnrichBatchItemResult[],
  phase: EnrichBatchItemInput["phase"],
  skipRegistryOnBulk: boolean,
): Promise<Map<string, T>> {
  const byId = new Map(specimens.map((s) => [s.id, s]));
  const out = new Map<string, T>();

  for (const row of results) {
    const specimen = byId.get(row.specimenId);
    if (!specimen) continue;

    if (row.ok && row.card && row.context) {
      out.set(row.specimenId, applyEnrichSuccess(specimen, row.card, row.context));
      continue;
    }

    const fallback = await enrichExtractedCardWithBatchFallback({
      specimenId: specimen.id,
      card: specimen.card,
      phase: phase ?? "catalog",
      skipRegistry: skipRegistryFor(specimen, skipRegistryOnBulk),
      ...(phase === "market" ? pickCatalogContext(specimen.context) : {}),
    });

    if (fallback.ok && fallback.card && fallback.context) {
      out.set(
        row.specimenId,
        applyEnrichSuccess(specimen, fallback.card, fallback.context),
      );
      continue;
    }

    if (phase === "catalog" || phase === "full") {
      const recovered = await recoverCatalogFromCandidates(specimen);
      out.set(row.specimenId, recovered ?? specimen);
      continue;
    }

    out.set(row.specimenId, specimen);
  }

  for (const specimen of specimens) {
    if (!out.has(specimen.id)) out.set(specimen.id, specimen);
  }
  return out;
}

async function runCatalogBatch<T extends SessionEnrichSpecimen>(
  chunk: T[],
  options: {
    skipRegistryOnBulk: boolean;
    catalogConcurrency: number;
    /** Combined catalog+market in one pass — disabled when market is deferred. */
    allowFullEnrich: boolean;
  },
): Promise<Map<string, T>> {
  const full = options.allowFullEnrich
    ? chunk.filter((s) => shouldUseCombinedFullEnrich(s.card))
    : [];
  const catalogOnly = chunk.filter(
    (s) => !options.allowFullEnrich || !shouldUseCombinedFullEnrich(s.card),
  );
  const merged = new Map<string, T>();

  const runWave = async (wave: T[], phase: "full" | "catalog") => {
    if (wave.length === 0) return;
    const batchItems: EnrichBatchItemInput[] = wave.map((specimen) => ({
      specimenId: specimen.id,
      card: specimen.card,
      phase,
      skipRegistry: skipRegistryFor(specimen, options.skipRegistryOnBulk),
    }));
    let results: EnrichBatchItemResult[] = [];
    try {
      results = await enrichExtractedCardsBatch({
        items: batchItems,
        phase,
        concurrency: options.catalogConcurrency,
        skipRegistry: options.skipRegistryOnBulk,
      });
    } catch {
      results = [];
    }
    const resolved = await mergeBatchResults(
      wave,
      results,
      phase,
      options.skipRegistryOnBulk,
    );
    for (const [id, row] of resolved) merged.set(id, row);
  };

  await runWave(full, "full");
  await runWave(catalogOnly, "catalog");
  return merged;
}

/**
 * Catalog match (+ optional widen). Returns resolved rows for a follow-up market pass.
 */
export async function runCatalogEnrichSession<T extends SessionEnrichSpecimen>(
  options: EnrichSessionPipelineOptions<T>,
): Promise<Map<string, T>> {
  const { items, profile, skipRegistryOnBulk, onProgress, onSpecimensPatch } = options;
  const catalogById = new Map<string, T>();
  if (items.length === 0) return catalogById;

  const total = items.length;
  const { catalog: catalogConcurrency } = enrichConcurrencyForCardCount(items.length, profile);
  const allowFullEnrich = options.deferMarket !== true;

  let enrichDone = 0;
  onProgress(`Matching catalog 0/${total}…`);

  for (let offset = 0; offset < items.length; offset += catalogConcurrency) {
    const chunk = items.slice(offset, offset + catalogConcurrency);
    const resolved = await runCatalogBatch(chunk, {
      skipRegistryOnBulk,
      catalogConcurrency,
      allowFullEnrich,
    });

    for (const specimen of chunk) {
      const next = resolved.get(specimen.id) ?? specimen;
      catalogById.set(specimen.id, next);
      onSpecimensPatch((current) =>
        current.map((entry) => (entry.id === specimen.id ? next : entry)),
      );
      enrichDone += 1;
      onProgress(`Matching catalog ${enrichDone}/${total}…`);
    }
  }

  const weakCatalog = [...catalogById.values()].filter((entry) => needsCatalogWiden(entry));

  if (weakCatalog.length > 0) {
    let widenDone = 0;
    const widenTotal = weakCatalog.length;
    const widenConcurrency = Math.min(3, widenTotal);
    onProgress(`Widening catalog 0/${widenTotal}…`);

    for (let offset = 0; offset < weakCatalog.length; offset += widenConcurrency) {
      const chunk = weakCatalog.slice(offset, offset + widenConcurrency);
      await Promise.all(
        chunk.map(async (entry) => {
          try {
            const result = await fetchCatalogCandidates({
              card: entry.card,
              existingCandidates: entry.context.catalogCandidates,
            });
            const widened = {
              ...entry,
              context: buildScanCardContext({
                specimenId: entry.id,
                card: entry.card,
                catalogId: result.catalogId,
                catalogIdentityStatus: result.catalogIdentityStatus,
                catalogConfidence: result.catalogConfidence,
                catalogCandidates: result.candidates,
                identityEvidence:
                  result.identityEvidence.length > 0
                    ? result.identityEvidence
                    : entry.context.identityEvidence,
                catalogImageUrl: result.catalogImageUrl ?? entry.context.catalogImageUrl,
                catalogImageSource:
                  result.catalogImageSource ?? entry.context.catalogImageSource,
                catalogImageSourceLabel:
                  result.catalogImageSourceLabel ?? entry.context.catalogImageSourceLabel,
                catalogImageNeedsReview:
                  result.catalogImageNeedsReview ?? entry.context.catalogImageNeedsReview,
                marketEvidence: entry.context.marketEvidence,
                marketSourceLinks: entry.context.marketSourceLinks,
                fairValueUsd: entry.context.fairValueUsd,
                fairValueBasis: entry.context.fairValueBasis,
                year: entry.card.year ?? entry.context.year,
              }),
            };
            catalogById.set(entry.id, widened);
            onSpecimensPatch((current) =>
              current.map((row) => (row.id === entry.id ? widened : row)),
            );
          } catch {
            // Keep fast-path catalog row when deep search fails.
          } finally {
            widenDone += 1;
            onProgress(`Widening catalog ${widenDone}/${widenTotal}…`);
          }
        }),
      );
    }
  }

  return catalogById;
}

/** Market comps / FMV — run after catalog when using deferred market. */
export async function runMarketEnrichSession<T extends SessionEnrichSpecimen>(
  options: MarketEnrichSessionOptions<T>,
): Promise<void> {
  const { items, profile, skipRegistryOnBulk, catalogById, onProgress, onSpecimensPatch } =
    options;
  if (items.length === 0) return;

  const { market: marketConcurrency } = enrichConcurrencyForCardCount(items.length, profile);

  const needsMarket = items.filter((specimen) => {
    const row = catalogById.get(specimen.id) ?? specimen;
    if (shouldUseCombinedFullEnrich(specimen.card) && rowHasMarketData(row.context)) {
      return false;
    }
    return !rowHasMarketData(row.context);
  });

  if (needsMarket.length === 0) return;

  let enrichDone = 0;
  onProgress(`Loading market 0/${needsMarket.length}…`);

  for (let offset = 0; offset < needsMarket.length; offset += marketConcurrency) {
    const chunk = needsMarket.slice(offset, offset + marketConcurrency);
    const batchItems: EnrichBatchItemInput[] = chunk.map((specimen) => {
      const base = catalogById.get(specimen.id) ?? specimen;
      return {
        specimenId: base.id,
        card: base.card,
        phase: "market",
        ...pickCatalogContext(base.context),
        skipRegistry: skipRegistryFor(base, skipRegistryOnBulk),
      };
    });

    let results: EnrichBatchItemResult[] = [];
    try {
      results = await enrichExtractedCardsBatch({
        items: batchItems,
        phase: "market",
        concurrency: marketConcurrency,
        skipRegistry: skipRegistryOnBulk,
      });
    } catch {
      results = [];
    }

    const resolved = await mergeBatchResults(
      chunk.map((s) => catalogById.get(s.id) ?? s),
      results,
      "market",
      skipRegistryOnBulk,
    );

    for (const specimen of chunk) {
      const base = catalogById.get(specimen.id) ?? specimen;
      const catalogCtx = pickCatalogContext(base.context);
      const next = resolved.get(specimen.id) ?? base;
      const patched =
        next.id === base.id && next.context !== base.context
          ? applyEnrichSuccess(next, next.card, next.context, catalogCtx)
          : next;

      onSpecimensPatch((current) =>
        current.map((entry) => (entry.id === base.id ? patched : entry)),
      );
      enrichDone += 1;
      onProgress(`Loading market ${enrichDone}/${needsMarket.length}…`);
    }
  }
}

/**
 * Catalog → optional widen → market using `/api/scan/enrich-batch`.
 * Set `deferMarket: true` to run only catalog+widen (use `runMarketEnrichSession` after).
 */
export async function runEnrichSessionPipeline<T extends SessionEnrichSpecimen>(
  options: EnrichSessionPipelineOptions<T>,
): Promise<Map<string, T>> {
  const catalogById = await runCatalogEnrichSession(options);
  if (options.deferMarket) return catalogById;

  await runMarketEnrichSession({
    items: options.items,
    profile: options.profile,
    skipRegistryOnBulk: options.skipRegistryOnBulk,
    catalogById,
    onProgress: options.onProgress,
    onSpecimensPatch: options.onSpecimensPatch,
  });
  return catalogById;
}
