import { buildMarketSourceLinks, type MarketSourceLink } from "@/lib/market/sources";
import {
  getCatalogSetOverlay,
  hasCatalogSetOverlay,
  type SealedProductSpec,
} from "@/lib/pokedex/catalog-set-overlay";
import type { SetInsightSealedProduct } from "@/lib/catalog/set-insight-payload";
import { extractedCardSchema } from "@/lib/scan/schemas";

function normalizeSealedLabel(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function sealedProductsFromOverlay(
  setName: string,
  products: SealedProductSpec[],
): SetInsightSealedProduct[] {
  return products.map((p) => {
    const extracted = extractedCardSchema.parse({
      name: p.searchQuery,
      set: setName,
      printStamps: "sealed pokemon tcg",
    });
    const links = buildMarketSourceLinks(extracted);
    const ebaySold = links.find((l) => l.source === "ebay" && l.lane === "sold")?.url;
    const priceCharting = links.find((l) => l.source === "pricecharting")?.url;
    return {
      label: p.label,
      note: p.category.replace(/_/g, " "),
      searchUrl: ebaySold ?? links[0]?.url ?? null,
      marketLinks: links,
      trackedSource: priceCharting ? "pricecharting" : ebaySold ? "ebay_sold" : null,
    };
  });
}

/** Default sealed SKUs for sets without a curated overlay (modern releases). */
export function defaultModernSealedProducts(setName: string): SealedProductSpec[] {
  const q = (suffix: string) => `Pokemon ${setName} ${suffix} sealed`;
  return [
    { id: "bb", label: "Booster box", category: "booster_box", searchQuery: q("booster box") },
    { id: "etb", label: "Elite Trainer Box", category: "etb", searchQuery: q("elite trainer box ETB") },
    { id: "bundle", label: "Booster bundle", category: "bundle", searchQuery: q("booster bundle 6 pack") },
    { id: "pack", label: "Booster pack", category: "booster_pack", searchQuery: q("booster pack") },
  ];
}

export function mergeSealedProducts(
  base: SetInsightSealedProduct[],
  priced: SetInsightSealedProduct[],
): SetInsightSealedProduct[] {
  if (!priced.length) return base;
  if (!base.length) return priced;

  const pricedByLabel = new Map<string, SetInsightSealedProduct>();
  for (const row of priced) {
    pricedByLabel.set(normalizeSealedLabel(row.label), row);
  }

  const merged = base.map((row) => {
    const match = pricedByLabel.get(normalizeSealedLabel(row.label));
    if (!match) return row;
    return {
      ...row,
      priceUsd: match.priceUsd ?? row.priceUsd,
      priceLabel: match.priceLabel ?? row.priceLabel,
      note: match.note?.trim() ? match.note : row.note,
      searchUrl: row.searchUrl ?? match.searchUrl,
      marketLinks: row.marketLinks ?? match.marketLinks,
      trackedSource: row.trackedSource ?? match.trackedSource,
    };
  });

  const seen = new Set(merged.map((row) => normalizeSealedLabel(row.label)));
  for (const row of priced) {
    const key = normalizeSealedLabel(row.label);
    if (seen.has(key)) continue;
    merged.push(row);
    seen.add(key);
  }

  return merged;
}

export function resolveDisplaySealedProducts(
  setId: string,
  setName: string,
  fromInsight?: SetInsightSealedProduct[] | null,
): SetInsightSealedProduct[] {
  const overlayRows = hasCatalogSetOverlay(setId)
    ? sealedProductsFromOverlay(setName, getCatalogSetOverlay(setId)?.sealedProducts ?? [])
    : sealedProductsFromOverlay(setName, defaultModernSealedProducts(setName));
  const insightRows = fromInsight ?? [];
  if (!insightRows.length) return overlayRows;
  return mergeSealedProducts(overlayRows, insightRows);
}

export function primaryTrackedLinks(links: MarketSourceLink[] | undefined): MarketSourceLink[] {
  if (!links?.length) return [];
  const order: MarketSourceLink["source"][] = [
    "pricecharting",
    "ebay",
    "tcgplayer",
    "cardmarket",
  ];
  const picked: MarketSourceLink[] = [];
  for (const source of order) {
    const sold = links.find((l) => l.source === source && l.lane === "sold");
    if (sold) picked.push(sold);
    else {
      const active = links.find((l) => l.source === source && l.lane === "active");
      if (active) picked.push(active);
    }
  }
  return picked.slice(0, 4);
}
