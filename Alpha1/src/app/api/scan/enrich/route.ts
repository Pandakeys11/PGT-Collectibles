import { NextRequest, NextResponse } from "next/server";
import { syncCurrentAppUser } from "@/lib/auth/app-user";
import {
  runEnrichForSpecimen,
  type EnrichPhase,
} from "@/lib/scan/enrich-runner";
import { isSlabzPartnerExtraction } from "@/lib/slabz/card-identity";
import { enrichSlabzSpecimenLikeScan } from "@/lib/slabz/enrich-slabz-specimen";
import type { CatalogContextSnapshot } from "@/lib/scan/context-builder";
import {
  catalogCandidateSchema,
  extractedCardSchema,
  identityEvidenceSchema,
} from "@/lib/scan/schemas";

export const maxDuration = 300;

function parsePhase(raw: string | undefined): EnrichPhase {
  if (raw === "catalog" || raw === "market" || raw === "full") return raw;
  return "full";
}

function parseCatalogSnapshot(body: Record<string, unknown>): Partial<CatalogContextSnapshot> {
  const catalogId =
    typeof body.catalogId === "string" && body.catalogId.trim()
      ? body.catalogId.trim()
      : null;
  const catalogCandidatesParsed = catalogCandidateSchema.array().safeParse(
    body.catalogCandidates,
  );
  const identityEvidenceParsed = identityEvidenceSchema.array().safeParse(
    body.identityEvidence,
  );

  return {
    catalogId,
    catalogImageUrl:
      typeof body.catalogImageUrl === "string" && body.catalogImageUrl.trim()
        ? body.catalogImageUrl.trim()
        : null,
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
    catalogIdentityStatus:
      body.catalogIdentityStatus === "confirmed" ||
      body.catalogIdentityStatus === "likely" ||
      body.catalogIdentityStatus === "ambiguous" ||
      body.catalogIdentityStatus === "failed"
        ? body.catalogIdentityStatus
        : catalogId
          ? "confirmed"
          : undefined,
    catalogConfidence:
      typeof body.catalogConfidence === "number" && Number.isFinite(body.catalogConfidence)
        ? body.catalogConfidence
        : undefined,
    catalogCandidates: catalogCandidatesParsed.success
      ? catalogCandidatesParsed.data
      : undefined,
    identityEvidence: identityEvidenceParsed.success
      ? identityEvidenceParsed.data
      : undefined,
  };
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const specimenId = String(body.specimenId ?? "").trim();
  if (!specimenId) {
    return NextResponse.json({ error: "specimenId required" }, { status: 400 });
  }

  const parsedCard = extractedCardSchema.safeParse(body.card);
  if (!parsedCard.success) {
    return NextResponse.json({ error: "Invalid card payload" }, { status: 400 });
  }

  const phase = parsePhase(typeof body.phase === "string" ? body.phase : undefined);
  const skipRegistry = body.skipRegistry === true;
  const skipCache = body.skipCache === true;
  const appUser = skipRegistry ? null : await syncCurrentAppUser();
  const userId = appUser?.id ?? null;

  const catalogSnapshot = phase === "market" || phase === "full" ? parseCatalogSnapshot(body) : {};
  const artMatchImageBase64 =
    typeof body.artMatchImageBase64 === "string" && body.artMatchImageBase64.trim()
      ? body.artMatchImageBase64.trim().slice(0, 8 * 1024 * 1024)
      : undefined;
  const artMatchMimeType =
    typeof body.artMatchMimeType === "string" && body.artMatchMimeType.trim()
      ? body.artMatchMimeType.trim()
      : undefined;

  const partnerExtraction =
    typeof body.extraction === "object" && body.extraction !== null
      ? (body.extraction as Record<string, unknown>)
      : typeof body.context === "object" && body.context !== null
        ? ((body.context as { extraction?: Record<string, unknown> }).extraction ?? null)
        : null;

  const catalogIdHint =
    typeof catalogSnapshot.catalogId === "string" ? catalogSnapshot.catalogId : null;
  const useSlabzEnrich =
    catalogIdHint?.startsWith("slabz:") || isSlabzPartnerExtraction(partnerExtraction);

  try {
    const result = useSlabzEnrich
      ? await enrichSlabzSpecimenLikeScan({
          specimenId,
          card: parsedCard.data,
          phase,
          skipRegistry,
          skipCache,
          userId,
          artMatchImageBase64,
          artMatchMimeType,
          ...catalogSnapshot,
          context: {
            ...catalogSnapshot,
            extraction: partnerExtraction ?? {},
          },
        })
      : await runEnrichForSpecimen({
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

    return NextResponse.json({
      card: result.card,
      context: result.context,
      catalogMatched: result.catalogMatched,
      catalogId: result.catalogId,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Enrichment failed" },
      { status: 500 },
    );
  }
}
