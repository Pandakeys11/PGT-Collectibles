import type { CatalogMatch } from "@/lib/market/pokemon-catalog";
import { hasCatalogIdentityFields } from "@/lib/scan/card-display";
import { hasReadableCertNumber } from "@/lib/scan/graded-slab";
import { extractedCardSchema, type ExtractedCard } from "@/lib/scan/schemas";

/** Fields that can trigger catalog + market refresh when edited manually. */
export const MANUAL_IDENTITY_FIELDS = [
  "franchise",
  "name",
  "set",
  "number",
  "year",
  "rarity",
  "printStamps",
  "printedName",
  "language",
  "grader",
  "grade",
  "cert",
  "labelTitle",
] as const satisfies readonly (keyof ExtractedCard)[];

export type ManualIdentityField = (typeof MANUAL_IDENTITY_FIELDS)[number];

export function patchTouchesManualIdentity(patch: Partial<ExtractedCard>): boolean {
  return MANUAL_IDENTITY_FIELDS.some((key) => key in patch);
}

export function hasMinimumIdentityForCatalog(card: ExtractedCard): boolean {
  return hasCatalogIdentityFields(card);
}

/**
 * Merge catalog hit into an extracted card.
 * Only confirmed catalog identities may overwrite vision/user fields. Likely or ambiguous
 * matches remain suggestions on the context so the scanner fails closed.
 */
function gradedSlabTrustsCatalog(card: ExtractedCard, catalog: CatalogMatch): boolean {
  const graded =
    card.visionLane === "graded" ||
    card.encapsulation === "graded_slab" ||
    hasReadableCertNumber(card.cert);
  if (!graded) return false;
  if (catalog.catalogIdentityStatus === "confirmed") return true;
  if (catalog.catalogIdentityStatus !== "likely") return false;
  const gap =
    catalog.score -
    (catalog.candidates?.[1]?.score ?? catalog.score - 20);
  return catalog.score >= 72 && gap >= 6;
}

export function mergeExtractedCardWithCatalog(
  card: ExtractedCard,
  catalog: CatalogMatch | null,
): ExtractedCard {
  if (!catalog) return card;

  const mayMerge =
    catalog.catalogIdentityStatus === "confirmed" ||
    gradedSlabTrustsCatalog(card, catalog);
  if (!mayMerge) return card;

  return extractedCardSchema.parse({
    ...card,
    name: catalog.name?.trim() ? catalog.name : card.name,
    set: catalog.setName ?? card.set,
    number: catalog.cardNumber ?? card.number,
    year: catalog.year ?? card.year,
    rarity: catalog.rarity ?? card.rarity,
    grader: card.grader,
    grade: card.grade,
    cert: card.cert,
    labelTitle: card.labelTitle,
    details: card.details,
    encapsulation: card.encapsulation ?? "graded_slab",
    visionLane: card.visionLane ?? "graded",
  });
}

export function catalogMatchIsAuthoritative(
  catalog: CatalogMatch | null,
  card?: ExtractedCard,
): boolean {
  if (!catalog) return false;
  if (catalog.catalogIdentityStatus === "confirmed") return true;
  if (card) return gradedSlabTrustsCatalog(card, catalog);
  return false;
}

function catalogHasCollectorNumberAgreement(catalog: CatalogMatch): boolean {
  return catalog.identityEvidence.some(
    (row) => row.field === "collector number" && row.status === "match",
  );
}

/**
 * Official catalog art for thumbnails — stricter than field merge.
 * Confirmed / trusted-slab matches always qualify; high-confidence likely
 * matches qualify when name + collector number agree (no name conflict).
 */
export function resolveCatalogImageUrl(
  catalog: CatalogMatch | null,
  card?: ExtractedCard,
): string | null {
  if (!catalog) return null;
  const url =
    catalog.imageSmallUrl ?? catalog.imageLargeUrl ?? catalog.imageUrl ?? null;
  if (!url) return null;
  if (catalogMatchIsAuthoritative(catalog, card)) return url;

  if (catalog.catalogIdentityStatus !== "likely") return null;
  if (catalog.candidates[0]?.conflicts?.includes("name conflict")) return null;
  const runnerScore = catalog.candidates[1]?.score ?? 0;
  const gap = catalog.score - runnerScore;
  if (catalog.score < 86 || gap < 12) return null;

  const expectsNumber = Boolean(card?.number?.trim());
  if (!expectsNumber) return url;
  return catalogHasCollectorNumberAgreement(catalog) ? url : null;
}

/** User explicitly selected a catalog row (Select in catalog panel). */
export function hasUserCatalogOverride(context: {
  catalogId: string | null;
  catalogConfidence: number;
}): boolean {
  return Boolean(context.catalogId?.trim()) && context.catalogConfidence >= 0.999;
}
