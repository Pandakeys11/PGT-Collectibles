import { readResponseJson } from "@/lib/http/read-response-json";
import type { ExtractedCard, ScanCardContext } from "@/lib/scan/schemas";
import { pickCatalogContext, type CatalogContextSnapshot } from "@/lib/scan/context-builder";

export type EnrichPhase = "full" | "catalog" | "market";

/** Server accepts at most this many specimens per batch request. */
export const ENRICH_BATCH_MAX_ITEMS = 24;

/** Drop in-memory enrich + Pokédex API caches (call on Clear session / new scan). */
export async function flushRuntimeCaches(): Promise<void> {
  try {
    await fetch("/api/scan/flush-caches", { method: "POST", cache: "no-store" });
  } catch {
    // Non-fatal if the server is unreachable.
  }
}

const TRANSIENT_ENRICH_STATUSES = new Set([404, 408, 429, 500, 502, 503, 504]);

function enrichBackoffMs(attempt: number): number {
  return 400 * (attempt + 1);
}

function batchTimeoutMs(phase: EnrichPhase, itemCount: number): number {
  const waves = Math.max(1, Math.ceil(itemCount / 6));
  const perWave =
    phase === "market" ? 92_000 : phase === "catalog" ? 48_000 : 78_000;
  const base = phase === "market" ? 25_000 : 18_000;
  return Math.min(280_000, base + waves * perWave);
}

export type EnrichBatchItemInput = {
  specimenId: string;
  card: ExtractedCard;
  phase?: EnrichPhase;
  skipRegistry?: boolean;
  skipCache?: boolean;
  artMatchImageBase64?: string;
  artMatchMimeType?: string;
} & Partial<CatalogContextSnapshot>;

export type EnrichBatchItemResult = {
  specimenId: string;
  ok: boolean;
  card?: ExtractedCard;
  context?: ScanCardContext;
  catalogMatched?: boolean;
  catalogId?: string | null;
  error?: string;
};

export async function enrichExtractedCard(args: {
  specimenId: string;
  card: ExtractedCard;
  phase?: EnrichPhase;
  catalogId?: string | null;
  catalogImageUrl?: string | null;
  catalogImageSource?: ScanCardContext["catalogImageSource"];
  catalogImageSourceLabel?: string | null;
  catalogImageNeedsReview?: boolean;
  catalogIdentityStatus?: ScanCardContext["catalogIdentityStatus"];
  catalogConfidence?: number;
  catalogCandidates?: ScanCardContext["catalogCandidates"];
  identityEvidence?: ScanCardContext["identityEvidence"];
  /** After resync, bypass market cache so identity/comps refresh for the new extraction. */
  skipCache?: boolean;
  /** Bulk scan: skip slow cert registry chain; load via /api/scan/registry when row is selected. */
  skipRegistry?: boolean;
  /** Override default client timeout (live camera uses shorter budgets). */
  timeoutMs?: number;
  artMatchImageBase64?: string;
  artMatchMimeType?: string;
  /** Slabz partner metadata from `context.extraction` — enables art match + identity repair. */
  extraction?: Record<string, unknown>;
}): Promise<{
  card: ExtractedCard;
  context: ScanCardContext;
  catalogMatched?: boolean;
  catalogId?: string | null;
}> {
  const phase = args.phase ?? "full";
  const timeoutMs =
    args.timeoutMs ??
    (phase === "catalog" ? 45_000 : phase === "market" ? 90_000 : 75_000);
  const maxAttempts = 3;

  let lastError = "Enrichment failed";

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, enrichBackoffMs(attempt - 1)));
    }

    let response: Response;
    try {
      const { skipRegistry, extraction, ...payload } = args;
      response = await fetch("/api/scan/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          skipRegistry: skipRegistry === true ? true : undefined,
          extraction: extraction && Object.keys(extraction).length > 0 ? extraction : undefined,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Enrichment request failed";
      if (attempt < maxAttempts - 1) continue;
      throw new Error(lastError);
    }

    const data = await readResponseJson<{
      card?: ExtractedCard;
      context?: ScanCardContext;
      catalogMatched?: boolean;
      catalogId?: string | null;
      error?: string;
    }>(response);

    if (response.ok && data.card && data.context) {
      return {
        card: data.card,
        context: data.context,
        catalogMatched: data.catalogMatched,
        catalogId: data.catalogId ?? null,
      };
    }

    lastError = data.error || `Enrichment failed (${response.status})`;
    if (TRANSIENT_ENRICH_STATUSES.has(response.status) && attempt < maxAttempts - 1) {
      continue;
    }
    break;
  }

  throw new Error(lastError);
}

async function postEnrichBatch(args: {
  items: EnrichBatchItemInput[];
  phase: EnrichPhase;
  skipRegistry?: boolean;
  concurrency?: number;
}): Promise<EnrichBatchItemResult[]> {
  const timeoutMs = batchTimeoutMs(args.phase, args.items.length);
  const maxAttempts = 2;
  let lastError = "Batch enrichment failed";

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, enrichBackoffMs(attempt - 1)));
    }

    let response: Response;
    try {
      response = await fetch("/api/scan/enrich-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          phase: args.phase,
          skipRegistry: args.skipRegistry === true ? true : undefined,
          concurrency: args.concurrency,
          items: args.items.map((item) => ({
            ...item,
            phase: item.phase ?? args.phase,
            skipRegistry: item.skipRegistry === true ? true : undefined,
            skipCache: item.skipCache === true ? true : undefined,
          })),
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Batch enrichment request failed";
      if (attempt < maxAttempts - 1) continue;
      throw new Error(lastError);
    }

    const data = await readResponseJson<{
      results?: EnrichBatchItemResult[];
      error?: string;
    }>(response);

    if (response.ok && Array.isArray(data.results)) {
      return data.results;
    }

    lastError = data.error || `Batch enrichment failed (${response.status})`;
    if (TRANSIENT_ENRICH_STATUSES.has(response.status) && attempt < maxAttempts - 1) {
      continue;
    }
    break;
  }

  throw new Error(lastError);
}

/**
 * Batch catalog / market / full enrich via `/api/scan/enrich-batch`.
 * Chunks automatically when more than {@link ENRICH_BATCH_MAX_ITEMS} specimens.
 */
export async function enrichExtractedCardsBatch(args: {
  items: EnrichBatchItemInput[];
  phase: EnrichPhase;
  skipRegistry?: boolean;
  concurrency?: number;
}): Promise<EnrichBatchItemResult[]> {
  if (args.items.length === 0) return [];

  const out: EnrichBatchItemResult[] = [];
  for (let offset = 0; offset < args.items.length; offset += ENRICH_BATCH_MAX_ITEMS) {
    const slice = args.items.slice(offset, offset + ENRICH_BATCH_MAX_ITEMS);
    const chunkResults = await postEnrichBatch({
      items: slice,
      phase: args.phase,
      skipRegistry: args.skipRegistry,
      concurrency: args.concurrency,
    });
    out.push(...chunkResults);
  }
  return out;
}

/** Retry failed batch rows with single-specimen `/api/scan/enrich`. */
export async function enrichExtractedCardWithBatchFallback(
  item: EnrichBatchItemInput,
): Promise<EnrichBatchItemResult> {
  try {
    const single = await enrichExtractedCard({
      specimenId: item.specimenId,
      card: item.card,
      phase: item.phase ?? "catalog",
      skipCache: item.skipCache,
      skipRegistry: item.skipRegistry,
      artMatchImageBase64: item.artMatchImageBase64,
      artMatchMimeType: item.artMatchMimeType,
      ...pickCatalogContextFields(item),
    });
    return {
      specimenId: item.specimenId,
      ok: true,
      card: single.card,
      context: single.context,
      catalogMatched: single.catalogMatched,
      catalogId: single.catalogId,
    };
  } catch (err) {
    return {
      specimenId: item.specimenId,
      ok: false,
      error: err instanceof Error ? err.message : "Enrichment failed",
    };
  }
}

function pickCatalogContextFields(
  item: EnrichBatchItemInput,
): Partial<CatalogContextSnapshot> {
  if (item.phase !== "market" && item.phase !== "full") return {};
  return {
    catalogId: item.catalogId,
    catalogImageUrl: item.catalogImageUrl,
    catalogImageSource: item.catalogImageSource,
    catalogImageSourceLabel: item.catalogImageSourceLabel,
    catalogImageNeedsReview: item.catalogImageNeedsReview,
    catalogIdentityStatus: item.catalogIdentityStatus,
    catalogConfidence: item.catalogConfidence,
    catalogCandidates: item.catalogCandidates,
    identityEvidence: item.identityEvidence,
  };
}

export type CatalogCandidatesPayload = {
  candidates: ScanCardContext["catalogCandidates"];
  catalogIdentityStatus: ScanCardContext["catalogIdentityStatus"];
  catalogConfidence: number;
  catalogId: string | null;
  catalogImageUrl: string | null;
  catalogImageSource?: ScanCardContext["catalogImageSource"];
  catalogImageSourceLabel?: string | null;
  catalogImageNeedsReview?: boolean;
  identityEvidence: ScanCardContext["identityEvidence"];
  catalogMatched: boolean;
};

/** Deep master-catalog / Pokédex search for manual identity pick. */
export async function fetchCatalogCandidates(args: {
  card: ExtractedCard;
  existingCandidates?: ScanCardContext["catalogCandidates"];
}): Promise<CatalogCandidatesPayload> {
  const response = await fetch("/api/scan/catalog-candidates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      card: args.card,
      existingCandidates: args.existingCandidates,
    }),
    signal: AbortSignal.timeout(20_000),
  });

  const data = await readResponseJson<CatalogCandidatesPayload & { error?: string }>(response);
  if (!response.ok) {
    throw new Error(data.error || `Catalog search failed (${response.status})`);
  }
  return data;
}

export async function recordScanObservation(args: {
  eventType: "user_confirm" | "user_reject" | "user_edit";
  specimenId: string;
  card: ExtractedCard;
  context?: Partial<ScanCardContext> | Record<string, unknown>;
  catalogId?: string | null;
}): Promise<void> {
  try {
    const response = await fetch("/api/scan/observation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType: args.eventType,
        specimenId: args.specimenId,
        card: args.card,
        context: args.context ?? {},
        catalogId: args.catalogId ?? null,
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return;
    await response.json().catch(() => null);
  } catch {
    // non-fatal
  }
}
