import type { BuiltScanSpecimen } from "@/lib/scan/build-specimens";

export type PokeGradeHudSnapshot = {
  cardName: string;
  subtitle: string;
  gradeLine: string | null;
  fairValueUsd: number | null;
  fairValueBasis: string | null;
  psa10SoldUsd: number | null;
  psa10SoldLabel: string | null;
  provider: "pgt" | "pokegrade";
  /** Catalog art when matched; falls back to capture preview in HUD. */
  catalogImageUrl?: string | null;
  capturePreviewUrl?: string | null;
  compsCount?: number;
  catalogVerified?: boolean;
  rarity?: string | null;
};

export type LiveScanResult = {
  specimen: BuiltScanSpecimen;
  previewUrl: string;
  hud: PokeGradeHudSnapshot;
};
