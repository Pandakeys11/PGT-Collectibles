import catalogOverlayRoot from "@/data/pokedex/catalog-set-overlays.json";
import type { PrintingPresetId, PrintingPresetOption } from "@/lib/pokedex/printing-presets";

export type SealedProductSpec = {
  id: string;
  label: string;
  category: string;
  /** Marketplace-agnostic search string for hub links */
  searchQuery: string;
};

export type PrintingVariantSpec = {
  id: PrintingPresetId;
  label: string;
  hint?: string;
  /** Passed as printStamps / printing= for marketplace bias; null for catalog spine */
  marketSuffix: string | null;
};

export type FinishVariantSpec = {
  id: "standard" | "reverse_holo" | "rare_holo" | "rare_non_holo";
  label: string;
  hint?: string;
  marketSuffix: string | null;
};

export type CatalogSetOverlay = {
  setId: string;
  bulbapediaUrl?: string;
  setValueNotes?: string;
  printingVariants: PrintingVariantSpec[];
  finishVariants?: FinishVariantSpec[];
  sealedProducts: SealedProductSpec[];
};

type CatalogSetOverlaysFile = {
  version: number;
  methodology: string;
  sets: CatalogSetOverlay[];
};

const FILE = catalogOverlayRoot as CatalogSetOverlaysFile;

const bySetId = new Map<string, CatalogSetOverlay>();
for (const row of FILE.sets) {
  bySetId.set(row.setId.trim(), row);
}

export const CATALOG_OVERLAY_METHODOLOGY = FILE.methodology;

export function getCatalogSetOverlay(setId: string): CatalogSetOverlay | undefined {
  return bySetId.get(setId.trim());
}

export function hasCatalogSetOverlay(setId: string): boolean {
  return bySetId.has(setId.trim());
}

export function printingPresetTabsFromOverlay(setId: string): PrintingPresetOption[] | null {
  const o = getCatalogSetOverlay(setId);
  if (!o?.printingVariants?.length) return null;
  if (o.printingVariants.length <= 1) return null;
  return o.printingVariants.map((v) => ({
    id: v.id,
    label: v.label,
    hint: v.hint,
  }));
}

export function printingPresetMarketSuffixForSet(
  setId: string | null | undefined,
  preset: PrintingPresetId,
): string | null {
  if (!setId?.trim()) return null;
  const v = getCatalogSetOverlay(setId)?.printingVariants?.find((x) => x.id === preset);
  if (!v) return null;
  return v.marketSuffix?.trim() || null;
}
