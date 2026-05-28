import type { CatalogFranchiseId } from "@/lib/catalog/catalog-types";

/** PGT catalog franchises hydrated via JustTCG (Pokémon uses pokemontcg.io). */
export const JUSTTCG_FRANCHISES: CatalogFranchiseId[] = [
  "magic",
  "yugioh",
  "lorcana",
  "onepiece",
];

const GAME_BY_FRANCHISE: Partial<Record<CatalogFranchiseId, string>> = {
  magic: "Magic: The Gathering",
  yugioh: "Yu-Gi-Oh!",
  lorcana: "Disney Lorcana",
  onepiece: "One Piece TCG",
};

export function justTcgGameForFranchise(franchise: CatalogFranchiseId): string | null {
  return GAME_BY_FRANCHISE[franchise] ?? null;
}

export function isJustTcgFranchise(franchise: string): franchise is CatalogFranchiseId {
  return JUSTTCG_FRANCHISES.includes(franchise as CatalogFranchiseId);
}
