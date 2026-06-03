/**
 * @deprecated Import from `@/lib/scan/same-art-disambiguation` instead.
 * Re-exports preserved for existing call sites.
 */
export {
  applyCatalogIdentityHardening,
  detectReverseHoloHints,
  requestedCatalogVariantFromCard,
} from "@/lib/scan/same-art-disambiguation";

import { applyCatalogIdentityHardening } from "@/lib/scan/same-art-disambiguation";
import type { ExtractedCard } from "@/lib/scan/schemas";

/** @deprecated Use applyCatalogIdentityHardening */
export function applyPrintFinishInference(card: ExtractedCard): ExtractedCard {
  return applyCatalogIdentityHardening(card);
}

/** @deprecated Use applyCatalogIdentityHardening */
export function applyReprintSetDisambiguation(card: ExtractedCard): ExtractedCard {
  return applyCatalogIdentityHardening(card);
}

import { detectReverseHoloHints } from "@/lib/scan/same-art-disambiguation";

/** @deprecated */
export function detectLegendaryCollectionHints(
  card: Pick<ExtractedCard, "set" | "details" | "printStamps" | "labelTitle" | "year">,
): boolean {
  const blob = [card.set, card.details, card.printStamps, card.labelTitle, card.year]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (/\blegendary\s*collection\b|\bleg\.?\s*coll\b|\bbase\s*6\b/.test(blob)) return true;
  if (card.year?.trim() === "2002" && detectReverseHoloHints(card)) return true;
  return false;
}
