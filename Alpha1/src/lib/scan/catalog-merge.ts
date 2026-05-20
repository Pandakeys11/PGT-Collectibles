import type { CatalogMatch } from "@/lib/market/pokemon-catalog";
import { hasCatalogIdentityFields } from "@/lib/scan/card-display";
import { extractedCardSchema, type ExtractedCard } from "@/lib/scan/schemas";

/** Fields that can trigger catalog + market refresh when edited manually. */
export const MANUAL_IDENTITY_FIELDS = [
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
export function mergeExtractedCardWithCatalog(
  card: ExtractedCard,
  catalog: CatalogMatch | null,
): ExtractedCard {
  if (!catalog) return card;

  if (catalog.catalogIdentityStatus !== "confirmed") return card;

  return extractedCardSchema.parse({
    ...card,
    name: catalog.name?.trim() ? catalog.name : card.name,
    set: catalog.setName ?? card.set,
    number: catalog.cardNumber ?? card.number,
    year: catalog.year ?? card.year,
    rarity: catalog.rarity ?? card.rarity,
  });
}

export function catalogMatchIsAuthoritative(catalog: CatalogMatch | null): boolean {
  if (!catalog) return false;
  return catalog.catalogIdentityStatus === "confirmed";
}
