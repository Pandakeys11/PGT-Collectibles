/**
 * Catalog UX helpers: Pokémon TCG API often merges print runs on one card row and Lucene
 * `rarity:Rare` matches both "Rare" and "Rare Holo" — see rarity-buckets fixes.
 */

import {
  getCatalogSetOverlay,
  printingPresetMarketSuffixForSet,
  printingPresetTabsFromOverlay,
} from "@/lib/pokedex/catalog-set-overlay";
import type { PrintingPresetId, PrintingPresetOption } from "@/lib/pokedex/printing-presets";

export type { PrintingPresetId, PrintingPresetOption } from "@/lib/pokedex/printing-presets";

/** Legendary Collection-style finish splits (set base6). */
export type CatalogFinishBucketId = "all" | "rare_holo" | "rare_non_holo";

export const CATALOG_FINISH_TAB_ORDER: CatalogFinishBucketId[] = ["all", "rare_holo", "rare_non_holo"];

export const CATALOG_FINISH_TAB_LABELS: Record<CatalogFinishBucketId, string> = {
  all: "All finishes",
  rare_holo: "Holo rares",
  rare_non_holo: "Non-holo rares",
};

/** Sets where Rare vs Rare Holo should be splittable via finish tabs. */
const FINISH_TAB_SET_IDS = new Set<string>(["base6"]);

export function supportsFinishTabs(setId: string): boolean {
  const sid = setId.trim();
  const overlay = getCatalogSetOverlay(sid);
  if (overlay?.finishVariants?.some((variant) => variant.id === "rare_holo" || variant.id === "rare_non_holo")) {
    return true;
  }
  return FINISH_TAB_SET_IDS.has(sid);
}

export function applyCatalogFinishClause(
  luceneQuery: string,
  setId: string,
  finish: CatalogFinishBucketId,
): string {
  if (finish === "all") return luceneQuery;
  const sid = setId.trim();
  if (!supportsFinishTabs(sid)) return luceneQuery;
  if (finish === "rare_holo") {
    return `${luceneQuery} AND rarity:"Rare Holo"`;
  }
  return `${luceneQuery} AND (rarity:Rare AND -rarity:"Rare Holo")`;
}

export function supportsPrintingPresets(setId: string): boolean {
  return printingPresetTabsFromOverlay(setId) != null;
}

export function printingPresetTabs(setId: string): PrintingPresetOption[] | null {
  return printingPresetTabsFromOverlay(setId);
}

export function printingPresetMarketSuffix(
  setId: string | null | undefined,
  preset: PrintingPresetId,
): string | null {
  const sid = setId?.trim();
  if (sid && getCatalogSetOverlay(sid)) {
    return printingPresetMarketSuffixForSet(sid, preset);
  }
  return legacyPrintingSuffix(preset);
}

function legacyPrintingSuffix(preset: PrintingPresetId): string | null {
  switch (preset) {
    case "catalog":
      return null;
    case "unlimited":
      return "Unlimited";
    case "first_edition":
      return "1st Edition";
    case "shadowless":
      return "Shadowless";
    default:
      return null;
  }
}
