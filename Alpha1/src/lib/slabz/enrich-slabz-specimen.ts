import "server-only";

import { fetchCatalogImageBase64 } from "@/lib/catalog/art-embedding";
import {
  isSlabzGraderBoilerplateName,
  isSlabzPartnerExtraction,
  mergeVisionWithSlabzPartnerCard,
  parseSlabzCardToExtractedCard,
  slabzCardFromExtraction,
} from "@/lib/slabz/card-identity";
import { loadSlabzCatalogIdentity } from "@/lib/slabz/catalog-identity";
import { runEnrichForSpecimen, type RunEnrichInput } from "@/lib/scan/enrich-runner";
import type { ExtractedCard, ScanCardContext } from "@/lib/scan/schemas";

export async function resolveSlabzEnrichInputCard(
  card: ExtractedCard,
  context: Partial<ScanCardContext> & { extraction?: Record<string, unknown> },
): Promise<{
  card: ExtractedCard;
  catalogId: string | null;
  catalogImageUrl: string | null;
}> {
  const catalogId = context.catalogId?.trim() || null;
  let working = card;

  const extraction =
    context.extraction ??
    (typeof context === "object" && "extraction" in context
      ? (context as { extraction?: Record<string, unknown> }).extraction
      : undefined);

  const slabzFromCtx = isSlabzPartnerExtraction(extraction)
    ? slabzCardFromExtraction(extraction)
    : null;

  if (slabzFromCtx) {
    working = mergeVisionWithSlabzPartnerCard(working, slabzFromCtx);
  }

  if (catalogId?.startsWith("slabz:")) {
    const row = await loadSlabzCatalogIdentity(catalogId);
    if (row?.slabzCard) {
      working = mergeVisionWithSlabzPartnerCard(working, row.slabzCard);
    } else if (row && isSlabzGraderBoilerplateName(working.name)) {
      working = {
        ...working,
        name: row.printedName?.trim() || row.name,
        set: working.set ?? row.setName ?? undefined,
        number: working.number ?? row.cardNumber ?? undefined,
        year: working.year ?? row.year ?? undefined,
        rarity: working.rarity ?? row.rarity ?? undefined,
      };
    }
  }

  const catalogImageUrl =
    context.catalogImageUrl?.trim() ||
    (catalogId?.startsWith("slabz:")
      ? ((await loadSlabzCatalogIdentity(catalogId))?.imageUrl ?? null)
      : null) ||
    slabzFromCtx?.imageUrl?.trim() ||
    null;

  return { card: working, catalogId, catalogImageUrl };
}

export type EnrichSlabzSpecimenInput = RunEnrichInput & {
  context: Partial<ScanCardContext> & { extraction?: Record<string, unknown> };
};

export async function enrichSlabzSpecimenLikeScan(input: EnrichSlabzSpecimenInput) {
  const phase = input.phase;
  const resolved = await resolveSlabzEnrichInputCard(input.card, input.context);

  let artMatchImageBase64 = input.artMatchImageBase64;
  let artMatchMimeType = input.artMatchMimeType;
  if (!artMatchImageBase64 && resolved.catalogImageUrl?.startsWith("http")) {
    try {
      const image = await fetchCatalogImageBase64(resolved.catalogImageUrl);
      if (image) {
        artMatchImageBase64 = image.base64;
        artMatchMimeType = image.mimeType;
      }
    } catch {
      /* art match optional */
    }
  }

  return runEnrichForSpecimen({
    ...input,
    card: resolved.card,
    phase,
    catalogId: resolved.catalogId ?? input.catalogId,
    catalogImageUrl: resolved.catalogImageUrl ?? input.catalogImageUrl,
    artMatchImageBase64,
    artMatchMimeType,
    catalogIdentityStatus:
      input.catalogIdentityStatus ??
      (resolved.catalogId?.startsWith("slabz:") ? "likely" : undefined),
  });
}

export { parseSlabzCardToExtractedCard };
