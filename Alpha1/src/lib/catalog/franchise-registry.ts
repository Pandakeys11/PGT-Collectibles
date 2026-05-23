import { CATALOG_SOURCES } from "@/lib/market/catalog-sources";
import type { CardFranchise } from "@/lib/scan/franchise";
import type { CatalogFranchiseId, CatalogFranchiseMeta } from "@/lib/catalog/catalog-types";

const BROWSE_ORDER: CatalogFranchiseId[] = [
  "pokemon",
  "magic",
  "yugioh",
  "onepiece",
  "lorcana",
  "dragonball",
  "sports",
];

const LABELS: Record<CatalogFranchiseId, string> = {
  pokemon: "Pokémon TCG",
  magic: "Magic: The Gathering",
  yugioh: "Yu-Gi-Oh!",
  onepiece: "One Piece TCG",
  lorcana: "Disney Lorcana",
  dragonball: "Dragon Ball Super",
  sports: "Sports cards",
};

export function parseCatalogFranchise(raw: string | null | undefined): CatalogFranchiseId | null {
  const id = raw?.trim().toLowerCase() as CatalogFranchiseId;
  if (id && BROWSE_ORDER.includes(id)) return id;
  return null;
}

export function catalogFranchiseFromCardFranchise(
  franchise: CardFranchise,
): CatalogFranchiseId | null {
  if (franchise === "other") return null;
  return franchise as CatalogFranchiseId;
}

export function defaultFranchiseMeta(id: CatalogFranchiseId): CatalogFranchiseMeta {
  const source = CATALOG_SOURCES[id];
  return {
    id,
    label: LABELS[id],
    sourceId: source?.id ?? id,
    sourceLabel: source?.label ?? LABELS[id],
    browseMode: id === "pokemon" ? "pokedex" : "unified",
    syncEnabled: id !== "sports",
    lastSyncedAt: null,
    cardCountEstimate: null,
  };
}

export function sortFranchiseMetas(metas: CatalogFranchiseMeta[]): CatalogFranchiseMeta[] {
  return [...metas].sort(
    (a, b) => BROWSE_ORDER.indexOf(a.id) - BROWSE_ORDER.indexOf(b.id),
  );
}
