import type { PrintingPresetId } from "@/lib/pokedex/printing-presets";
import tcgplayerMap from "@/data/pokedex/tcgplayer-vintage-print-ids.json";

type VintagePrintMap = {
  version?: number;
  sets?: Record<
    string,
    {
      unlimited?: { productIdBase?: number };
      shadowless?: Record<string, number>;
      shadowlessOverrides?: Record<string, number>;
      first_edition?: Record<string, number>;
    }
  >;
};

const map = tcgplayerMap as VintagePrintMap;

function tcgplayerImageUrl(productId: number): { small: string; large: string } {
  const base = `https://product-images.tcgplayer.com/fit-in/437x437/${productId}.jpg`;
  return { small: base, large: base };
}

function resolveProductId(
  setId: string,
  cardId: string,
  preset: Exclude<PrintingPresetId, "catalog">,
): number | null {
  const setRow = map.sets?.[setId];
  if (!setRow) return null;

  if (preset === "shadowless") {
    const direct = setRow.shadowless?.[cardId] ?? setRow.shadowlessOverrides?.[cardId];
    if (direct) return direct;
    return null;
  }

  if (preset === "unlimited" && setRow.unlimited?.productIdBase) {
    const m = cardId.match(/-(\d+)$/);
    const num = m ? Number.parseInt(m[1]!, 10) : NaN;
    if (!Number.isFinite(num)) return null;
    return setRow.unlimited.productIdBase + num;
  }

  if (preset === "first_edition" && setRow.first_edition?.[cardId]) {
    return setRow.first_edition[cardId]!;
  }

  return null;
}

export function resolveTcgplayerVintagePrintUrls(params: {
  setId: string;
  cardId: string;
  printingPreset: Exclude<PrintingPresetId, "catalog">;
}): { small: string; large: string } | null {
  const productId = resolveProductId(params.setId, params.cardId, params.printingPreset);
  if (!productId) return null;
  return tcgplayerImageUrl(productId);
}
