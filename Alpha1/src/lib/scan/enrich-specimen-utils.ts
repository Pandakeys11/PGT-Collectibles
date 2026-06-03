import { MIN_CATALOG_PICK_OPTIONS } from "@/lib/market/ensure-catalog-options";
import {
  hasMinimumIdentityForCatalog,
  hasUserCatalogOverride,
} from "@/lib/scan/catalog-merge";
import { inferCardFranchise } from "@/lib/scan/franchise";
import { hasCoreCatalogIdentity } from "@/lib/scan/precision-crop-policy";
import type { ExtractedCard, ScanCardContext } from "@/lib/scan/schemas";

export type EnrichableSpecimen = {
  id: string;
  card: ExtractedCard;
  context: ScanCardContext;
  previewUrl?: string | null;
};

/** One HTTP call: catalog + market when vision identity is already strong. */
export function shouldUseCombinedFullEnrich(card: ExtractedCard): boolean {
  return hasCoreCatalogIdentity(card);
}

export function rowHasMarketData(context: ScanCardContext): boolean {
  return context.marketEvidence.length > 0 || context.fairValueUsd != null;
}

/** Catalog match strong enough to load market without a widen pass first. */
export function isStrongCatalogRow(entry: EnrichableSpecimen): boolean {
  if (hasUserCatalogOverride(entry.context)) return true;
  if (entry.context.catalogIdentityStatus === "confirmed") return true;
  if (
    entry.context.catalogIdentityStatus === "likely" &&
    entry.context.catalogId &&
    entry.context.catalogConfidence >= 0.72
  ) {
    return true;
  }
  return false;
}

/** Rows that need deep catalog search before market comps are reliable. */
export function needsCatalogWiden(entry: EnrichableSpecimen): boolean {
  if (!hasMinimumIdentityForCatalog(entry.card)) return false;
  if (hasUserCatalogOverride(entry.context)) return false;
  if (entry.context.catalogIdentityStatus === "confirmed") return false;
  const pokemon = inferCardFranchise(entry.card).isPokemon;
  const thinCandidates =
    entry.context.catalogCandidates.length < MIN_CATALOG_PICK_OPTIONS;
  const noArt = !entry.context.catalogImageUrl?.trim();
  const weakStatus =
    entry.context.catalogIdentityStatus === "failed" ||
    entry.context.catalogIdentityStatus === "ambiguous";
  if (pokemon && (thinCandidates || noArt || weakStatus)) return true;
  return thinCandidates;
}
