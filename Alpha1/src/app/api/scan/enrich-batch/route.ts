import { NextRequest, NextResponse } from "next/server";
import { syncCurrentAppUser } from "@/lib/auth/app-user";
import {
  mapWithConcurrency,
  runEnrichForSpecimen,
  type EnrichPhase,
} from "@/lib/scan/enrich-runner";
import { extractedCardSchema } from "@/lib/scan/schemas";
import type { CatalogContextSnapshot } from "@/lib/scan/context-builder";
import type { ExtractedCard, ScanCardContext } from "@/lib/scan/schemas";
import {
  catalogCandidateSchema,
  identityEvidenceSchema,
} from "@/lib/scan/schemas";

export const maxDuration = 300;

const MAX_BATCH_ITEMS = 24;
const DEFAULT_SERVER_CONCURRENCY = 6;

export type EnrichBatchItemResult = {
  specimenId: string;
  ok: boolean;
  card?: ExtractedCard;
  context?: ScanCardContext;
  catalogMatched?: boolean;
  catalogId?: string | null;
  error?: string;
};

export async function POST(req: NextRequest) {
  let body: {
    items?: Array<{
      specimenId?: string;
      card?: unknown;
      phase?: string;
      skipRegistry?: boolean;
      skipCache?: boolean;
      catalogId?: string | null;
      catalogImageUrl?: string | null;
      catalogImageSource?: string | null;
      catalogImageSourceLabel?: string | null;
      catalogImageNeedsReview?: boolean;
      catalogIdentityStatus?: string;
      catalogConfidence?: number;
      catalogCandidates?: unknown;
      identityEvidence?: unknown;
      artMatchImageBase64?: string;
      artMatchMimeType?: string;
    }>;
    phase?: string;
    skipRegistry?: boolean;
    concurrency?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) {
    return NextResponse.json({ error: "items required" }, { status: 400 });
  }
  if (items.length > MAX_BATCH_ITEMS) {
    return NextResponse.json(
      { error: `At most ${MAX_BATCH_ITEMS} items per batch` },
      { status: 413 },
    );
  }

  const defaultPhase: EnrichPhase =
    body.phase === "full" ? "full" : "catalog";
  const globalSkipRegistry = body.skipRegistry === true;
  const appUser = globalSkipRegistry ? null : await syncCurrentAppUser();
  const userId = appUser?.id ?? null;
  const concurrency = Math.min(
    DEFAULT_SERVER_CONCURRENCY,
    Math.max(
      1,
      Math.min(
        items.length,
        typeof body.concurrency === "number" && Number.isFinite(body.concurrency)
          ? Math.floor(body.concurrency)
          : DEFAULT_SERVER_CONCURRENCY,
      ),
    ),
  );

  const results = await mapWithConcurrency(items, concurrency, async (item) => {
    const specimenId = String(item.specimenId ?? "").trim();
    if (!specimenId) {
      return { specimenId: "", ok: false, error: "specimenId required" } satisfies EnrichBatchItemResult;
    }

    const parsedCard = extractedCardSchema.safeParse(item.card);
    if (!parsedCard.success) {
      return {
        specimenId,
        ok: false,
        error: "Invalid card payload",
      } satisfies EnrichBatchItemResult;
    }

    const phase: EnrichPhase =
      item.phase === "full" || item.phase === "catalog" || item.phase === "market"
        ? item.phase
        : defaultPhase;

    const skipRegistry = item.skipRegistry === true || globalSkipRegistry;
    const skipCache = item.skipCache === true;
    const artMatchImageBase64 =
      typeof item.artMatchImageBase64 === "string" && item.artMatchImageBase64.trim()
        ? item.artMatchImageBase64.trim().slice(0, 8 * 1024 * 1024)
        : undefined;
    const artMatchMimeType =
      typeof item.artMatchMimeType === "string" && item.artMatchMimeType.trim()
        ? item.artMatchMimeType.trim()
        : undefined;
    const catalogCandidatesParsed = catalogCandidateSchema.array().safeParse(
      item.catalogCandidates,
    );
    const identityEvidenceParsed = identityEvidenceSchema.array().safeParse(
      item.identityEvidence,
    );
    const catalogId =
      typeof item.catalogId === "string" && item.catalogId.trim()
        ? item.catalogId.trim()
        : null;

    const catalogSnapshot: Partial<CatalogContextSnapshot> =
      phase === "market"
        ? {
            catalogId,
            catalogImageUrl:
              typeof item.catalogImageUrl === "string" && item.catalogImageUrl.trim()
                ? item.catalogImageUrl.trim()
                : null,
            catalogImageSource:
              item.catalogImageSource === "exact_japanese_print" ||
              item.catalogImageSource === "same_art_confirmed" ||
              item.catalogImageSource === "english_fallback" ||
              item.catalogImageSource === "needs_image_review"
                ? item.catalogImageSource
                : null,
            catalogImageSourceLabel:
              typeof item.catalogImageSourceLabel === "string"
                ? item.catalogImageSourceLabel
                : null,
            catalogImageNeedsReview: item.catalogImageNeedsReview === true,
            catalogIdentityStatus:
              item.catalogIdentityStatus === "confirmed" ||
              item.catalogIdentityStatus === "likely" ||
              item.catalogIdentityStatus === "ambiguous" ||
              item.catalogIdentityStatus === "failed"
                ? item.catalogIdentityStatus
                : catalogId
                  ? "confirmed"
                  : undefined,
            catalogConfidence:
              typeof item.catalogConfidence === "number" &&
              Number.isFinite(item.catalogConfidence)
                ? item.catalogConfidence
                : undefined,
            catalogCandidates: catalogCandidatesParsed.success
              ? catalogCandidatesParsed.data
              : undefined,
            identityEvidence: identityEvidenceParsed.success
              ? identityEvidenceParsed.data
              : undefined,
          }
        : {};

    try {
      const result = await runEnrichForSpecimen({
        specimenId,
        card: parsedCard.data,
        phase,
        skipRegistry,
        skipCache,
        userId,
        artMatchImageBase64,
        artMatchMimeType,
        ...catalogSnapshot,
      });
      return {
        specimenId,
        ok: true,
        card: result.card,
        context: result.context,
        catalogMatched: result.catalogMatched,
        catalogId: result.catalogId,
      } satisfies EnrichBatchItemResult;
    } catch (err) {
      return {
        specimenId,
        ok: false,
        error: err instanceof Error ? err.message : "Enrichment failed",
      } satisfies EnrichBatchItemResult;
    }
  });

  return NextResponse.json({ results });
}
