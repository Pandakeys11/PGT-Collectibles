import type { TcgCardSummary } from "@/lib/pokedex/tcg-api-types";
import type { PrintingPresetId } from "@/lib/pokedex/printing-presets";
import manifestRoot from "@/data/pokedex/catalog-variant-artwork.json";
import { isLegendaryCollectionCatalogExpand } from "@/lib/pokedex/legendary-collection-catalog";
import { supportsPrintingPresets } from "@/lib/pokedex/set-catalog-config";
import { resolveTcgplayerVintagePrintUrls } from "@/lib/pokedex/tcgplayer-vintage-print-artwork";

export type CatalogArtworkUrls = { small?: string; large?: string };

/** How the resolved image URL was chosen (drives UI honesty + scan handoff). */
export type CatalogArtworkSource =
  | "curated"
  | "tcgplayer"
  | "conventional"
  | "api";

export type CatalogResolvedCardImages = CatalogArtworkUrls & {
  source: CatalogArtworkSource;
};

type CardArtworkRow = Partial<Record<string, CatalogArtworkUrls>>;

type ManifestFile = {
  version: number;
  guardRailsUrl?: string;
  sets: Record<string, Record<string, CardArtworkRow>>;
};

const manifest = manifestRoot as ManifestFile;

const VINTAGE_PRINT_KEYS = ["unlimited", "first_edition", "shadowless"] as const;

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

function urlKey(urls: CatalogArtworkUrls | null): string | null {
  if (!urls) return null;
  const u = (urls.large ?? urls.small)?.trim();
  return u || null;
}

/** True when overlay/manifest rows repeat the same URL for every print tab (bad PGT export). */
export function overlayRowHasDistinctPrintUrls(row: CardArtworkRow | undefined): boolean {
  if (!row) return false;
  const keys = VINTAGE_PRINT_KEYS.filter((k) => urlKey(pickUrls(row[k])));
  if (keys.length < 2) return keys.length === 1;
  const first = urlKey(pickUrls(row[keys[0]!]));
  return keys.some((k) => urlKey(pickUrls(row[k])) !== first);
}

function pickDistinctVariant(
  overlayRow: CardArtworkRow | undefined,
  staticRow: CardArtworkRow | undefined,
  variantKey: string,
): CatalogArtworkUrls | null {
  const overlayUrls = pickUrls(overlayRow?.[variantKey]);
  const staticUrls = pickUrls(staticRow?.[variantKey]);

  if (overlayUrls && overlayRowHasDistinctPrintUrls(overlayRow)) {
    return overlayUrls;
  }

  if (overlayUrls && !overlayRowHasDistinctPrintUrls(overlayRow)) {
    const apiKey = urlKey(overlayUrls);
    const allSame = VINTAGE_PRINT_KEYS.every((k) => {
      const u = urlKey(pickUrls(overlayRow?.[k]));
      return !u || u === apiKey;
    });
    if (allSame) {
      // Fall through — merged export duplicated pokemontcg.io on every tab.
    } else {
      return overlayUrls;
    }
  }

  return staticUrls ?? (overlayRowHasDistinctPrintUrls(overlayRow) ? overlayUrls : null);
}

/**
 * Optional curated scans: (1) PGT Market merged JSON via overlay, (2) repo `catalog-variant-artwork.json`,
 * (3) files under `/public/catalog-variant-artwork/{setId}/{cardId}_*.png`, (4) TCGplayer print-run scans,
 * (5) Pokémon TCG API.
 */
export function resolveCatalogCardImages(params: {
  setId: string | null | undefined;
  card: Pick<TcgCardSummary, "id" | "images" | "catalogFinish">;
  printingPreset: PrintingPresetId;
  /** From `GET /api/pokedex/variant-artwork-overlay` — bulk PGT Market `imageSmall` / `imageLarge`. */
  overlay?: CatalogVariantOverlayByCardId | null;
}): CatalogResolvedCardImages {
  const sid = params.setId?.trim();
  const cid = params.card.id.trim();
  const apiSmall = params.card.images?.small;
  const apiLarge = params.card.images?.large ?? apiSmall;

  if (!sid) {
    return { small: apiSmall, large: apiLarge, source: "api" };
  }

  const staticRow = manifest.sets[sid]?.[cid];
  const overlayRow = params.overlay?.[cid];

  if (isLegendaryCollectionCatalogExpand(sid)) {
    const key = params.card.catalogFinish === "reverse_holo" ? "reverse_holo" : "standard";
    const fromMerged = pickDistinctVariant(overlayRow, staticRow, key);
    if (fromMerged) {
      return {
        small: fromMerged.small ?? apiSmall,
        large: fromMerged.large ?? fromMerged.small ?? apiLarge,
        source: "curated",
      };
    }
    if (key === "reverse_holo") {
      const conv = `/catalog-variant-artwork/${sid}/${cid}_reverse.png`;
      if (apiSmall || apiLarge) {
        return { small: apiSmall ?? conv, large: apiLarge ?? apiSmall ?? conv, source: "api" };
      }
      return { small: conv, large: conv, source: "conventional" };
    }
    const stdMerged = pickDistinctVariant(overlayRow, staticRow, "standard");
    if (stdMerged) {
      return {
        small: stdMerged.small ?? apiSmall,
        large: stdMerged.large ?? stdMerged.small ?? apiLarge,
        source: "curated",
      };
    }
    return { small: apiSmall, large: apiLarge, source: "api" };
  }

  if (supportsPrintingPresets(sid) && params.printingPreset !== "catalog") {
    const presetKey = params.printingPreset;

    const fromMerged = pickDistinctVariant(overlayRow, staticRow, presetKey);
    if (fromMerged) {
      return {
        small: fromMerged.small ?? apiSmall,
        large: fromMerged.large ?? fromMerged.small ?? apiLarge,
        source: "curated",
      };
    }

    const fromTcgplayer = resolveTcgplayerVintagePrintUrls({
      setId: sid,
      cardId: cid,
      printingPreset: presetKey,
    });
    if (fromTcgplayer) {
      return {
        small: fromTcgplayer.small ?? apiSmall,
        large: fromTcgplayer.large ?? fromTcgplayer.small ?? apiLarge,
        source: "tcgplayer",
      };
    }

    // 1st Edition: official API / pokemontcg.io scans usually show the stamp (overlay often wrongly duplicates).
    if (presetKey === "first_edition") {
      return { small: apiSmall, large: apiLarge, source: "api" };
    }

    const suffix: Record<Exclude<PrintingPresetId, "catalog">, string> = {
      unlimited: "unlimited",
      first_edition: "first_edition",
      shadowless: "shadowless",
    };
    const suf = suffix[presetKey];
    const conv = `/catalog-variant-artwork/${sid}/${cid}_${suf}.png`;
    if (apiSmall || apiLarge) {
      return { small: apiSmall ?? conv, large: apiLarge ?? apiSmall ?? conv, source: "api" };
    }
    return { small: conv, large: conv, source: "conventional" };
  }

  return { small: apiSmall, large: apiLarge, source: "api" };
}

/** Best URL to render in the grid/detail (API-first, then curated). */
export function catalogCardPosterUrl(
  card: Pick<TcgCardSummary, "images">,
  resolved: CatalogResolvedCardImages,
): string | undefined {
  return (
    card.images?.large ??
    card.images?.small ??
    resolved.large ??
    resolved.small
  );
}

/** True when a non-catalog print tab should never fall back to generic API art. */
export function printRunTabRequiresVerifiedArt(preset: PrintingPresetId): boolean {
  return preset !== "catalog";
}

/** Unlimited tab may use API art when no verified unlimited scan exists. */
export function printRunTabAllowsApiFallback(
  preset: PrintingPresetId,
  source: CatalogArtworkSource,
): boolean {
  if (preset === "catalog") return true;
  if (preset === "unlimited" && source === "api") return true;
  return false;
}
