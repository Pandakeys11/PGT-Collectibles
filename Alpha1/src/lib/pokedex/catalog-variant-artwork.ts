import type { TcgCardSummary } from "@/lib/pokedex/tcg-api-types";
import type { PrintingPresetId } from "@/lib/pokedex/printing-presets";
import manifestRoot from "@/data/pokedex/catalog-variant-artwork.json";
import { isLegendaryCollectionCatalogExpand } from "@/lib/pokedex/legendary-collection-catalog";
import { supportsPrintingPresets } from "@/lib/pokedex/set-catalog-config";

export type CatalogArtworkUrls = { small?: string; large?: string };

type CardArtworkRow = Partial<Record<string, CatalogArtworkUrls>>;

type ManifestFile = {
  version: number;
  guardRailsUrl?: string;
  sets: Record<string, Record<string, CardArtworkRow>>;
};

const manifest = manifestRoot as ManifestFile;

/** Per-card rows from PGT Market bulk export (`variant-artwork-overlay` API). */
export type CatalogVariantOverlayByCardId = Record<string, CardArtworkRow>;

export function getCatalogVariantArtworkGuardRailsUrl(): string | null {
  const u = manifest.guardRailsUrl?.trim();
  return u || null;
}

function pickUrls(row: CatalogArtworkUrls | undefined): CatalogArtworkUrls | null {
  if (!row) return null;
  if (!row.small && !row.large) return null;
  return row;
}

function pickVariant(
  overlayRow: CardArtworkRow | undefined,
  staticRow: CardArtworkRow | undefined,
  variantKey: string,
): CatalogArtworkUrls | null {
  return (
    pickUrls(overlayRow?.[variantKey] as CatalogArtworkUrls | undefined) ??
    pickUrls(staticRow?.[variantKey] as CatalogArtworkUrls | undefined)
  );
}

/**
 * Optional curated scans: (1) PGT Market merged JSON via overlay, (2) repo `catalog-variant-artwork.json`,
 * (3) files under `/public/catalog-variant-artwork/{setId}/{cardId}_*.png`, (4) Pokémon TCG API.
 */
export function resolveCatalogCardImages(params: {
  setId: string | null | undefined;
  card: Pick<TcgCardSummary, "id" | "images" | "catalogFinish">;
  printingPreset: PrintingPresetId;
  /** From `GET /api/pokedex/variant-artwork-overlay` — bulk PGT Market `imageSmall` / `imageLarge`. */
  overlay?: CatalogVariantOverlayByCardId | null;
}): { small: string | undefined; large: string | undefined } {
  const sid = params.setId?.trim();
  const cid = params.card.id.trim();
  const apiSmall = params.card.images?.small;
  const apiLarge = params.card.images?.large ?? apiSmall;

  if (!sid) {
    return { small: apiSmall, large: apiLarge };
  }

  const staticRow = manifest.sets[sid]?.[cid];
  const overlayRow = params.overlay?.[cid];

  if (isLegendaryCollectionCatalogExpand(sid)) {
    const key = params.card.catalogFinish === "reverse_holo" ? "reverse_holo" : "standard";
    const fromMerged = pickVariant(overlayRow, staticRow, key);
    if (fromMerged) {
      return {
        small: fromMerged.small ?? apiSmall,
        large: fromMerged.large ?? fromMerged.small ?? apiLarge,
      };
    }
    if (key === "reverse_holo") {
      const conv = `/catalog-variant-artwork/${sid}/${cid}_reverse.png`;
      return { small: conv, large: conv };
    }
    const stdMerged = pickVariant(overlayRow, staticRow, "standard");
    if (stdMerged) {
      return {
        small: stdMerged.small ?? apiSmall,
        large: stdMerged.large ?? stdMerged.small ?? apiLarge,
      };
    }
    return { small: apiSmall, large: apiLarge };
  }

  if (supportsPrintingPresets(sid) && params.printingPreset !== "catalog") {
    const presetKey = params.printingPreset;
    const fromMerged = pickVariant(overlayRow, staticRow, presetKey);
    if (fromMerged) {
      return {
        small: fromMerged.small ?? apiSmall,
        large: fromMerged.large ?? fromMerged.small ?? apiLarge,
      };
    }
    const suffix: Record<Exclude<PrintingPresetId, "catalog">, string> = {
      unlimited: "unlimited",
      first_edition: "first_edition",
      shadowless: "shadowless",
    };
    const suf = suffix[params.printingPreset as Exclude<PrintingPresetId, "catalog">];
    if (suf) {
      const conv = `/catalog-variant-artwork/${sid}/${cid}_${suf}.png`;
      return { small: conv, large: conv };
    }
  }

  return { small: apiSmall, large: apiLarge };
}
