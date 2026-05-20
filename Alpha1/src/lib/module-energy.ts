import type { EnergyType } from "@/lib/energy-theme";

/** Desk module → dominant Pokémon energy accent. */
export type DeskModuleId = "scanner" | "master" | "catalog" | "market" | "ai" | "companion";

export const MODULE_ENERGY: Record<DeskModuleId, EnergyType> = {
  scanner: "electric",
  master: "metal",
  catalog: "fighting",
  market: "grass",
  ai: "psychic",
  companion: "fairy",
};

export const MODULE_ENERGY_SECONDARY: Partial<Record<DeskModuleId, EnergyType>> = {
  scanner: "water",
  catalog: "fire",
  market: "water",
  ai: "dragon",
  companion: "psychic",
};
