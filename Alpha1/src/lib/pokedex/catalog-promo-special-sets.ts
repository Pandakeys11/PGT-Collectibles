import rows from "@/data/pokedex/catalog-promo-special-sets.json";

export type CatalogPromoSpecialBucket = "promo" | "special";

export type CatalogPromoSpecialRow = {
  setId: string;
  name: string;
  bucket: CatalogPromoSpecialBucket;
  era: string;
};

const FILE = rows as CatalogPromoSpecialRow[];

const bySetId = new Map<string, CatalogPromoSpecialRow>();
for (const r of FILE) {
  bySetId.set(r.setId.trim(), r);
}

export function getCatalogPromoSpecialRow(setId: string): CatalogPromoSpecialRow | undefined {
  return bySetId.get(setId.trim());
}

export function listCatalogPromoSpecialSetIds(): string[] {
  return Array.from(bySetId.keys());
}
