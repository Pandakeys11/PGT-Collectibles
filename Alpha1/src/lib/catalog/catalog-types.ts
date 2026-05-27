/** Unified master catalog types (browse + scan handoff). */

export type CatalogFranchiseId =
  | "pokemon"
  | "magic"
  | "yugioh"
  | "onepiece"
  | "lorcana"
  | "dragonball"
  | "sports";

export type CatalogSetSummary = {
  id: string;
  name: string;
  code: string | null;
  series: string | null;
  releaseDate: string | null;
  year: string | null;
  printedTotal: number | null;
  total: number | null;
  images?: { symbol?: string; logo?: string };
  franchise: CatalogFranchiseId;
};

export type CatalogCardSummary = {
  id: string;
  name: string;
  number: string | null;
  rarity: string | null;
  supertype: string | null;
  catalogFinish?: "reverse_holo";
  catalogVariantKey?: string | null;
  catalogVariantLabel?: string | null;
  sourceCatalogId?: string | null;
  images?: { small?: string; large?: string };
  set?: {
    id: string;
    name: string;
    code?: string | null;
    releaseDate?: string | null;
  };
  franchise: CatalogFranchiseId;
  tcgplayer?: { url?: string };
};

export type CatalogPaginated<T> = {
  data: T[];
  page: number;
  pageSize: number;
  count: number;
  totalCount: number;
};

export type CatalogFranchiseMeta = {
  id: CatalogFranchiseId;
  label: string;
  sourceId: string;
  sourceLabel: string;
  browseMode: "pokedex" | "unified";
  syncEnabled: boolean;
  lastSyncedAt: string | null;
  cardCountEstimate: number | null;
};

export function releaseYearFromDate(releaseDate: string | null | undefined): string | null {
  if (!releaseDate?.trim()) return null;
  const y = releaseDate.trim().slice(0, 4);
  return /^\d{4}$/.test(y) ? y : null;
}
