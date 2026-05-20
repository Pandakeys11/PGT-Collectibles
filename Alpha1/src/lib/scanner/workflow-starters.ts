import type { CompanionPokemon } from "@/lib/companion/pokemon-roster";
import { COMPANION_ROSTER } from "@/lib/companion/pokemon-roster";
import type { EnergyType } from "@/lib/energy-theme";

export const SCANNER_STARTER_POOL: CompanionPokemon[] = COMPANION_ROSTER.filter(
  (p) => p.tier === "starter",
);

export function pickRandomStarterPokemon(): CompanionPokemon {
  const pool = SCANNER_STARTER_POOL;
  return pool[Math.floor(Math.random() * pool.length)] ?? pool[0]!;
}

const TYPE_TO_ENERGY: Record<string, EnergyType> = {
  fire: "fire",
  water: "water",
  grass: "grass",
  electric: "electric",
  psychic: "psychic",
  dark: "dark",
  steel: "metal",
  metal: "metal",
  fighting: "fighting",
  fairy: "fairy",
  dragon: "dragon",
  ice: "water",
  normal: "psychic",
  poison: "grass",
  ground: "fighting",
  flying: "electric",
  bug: "grass",
  rock: "fighting",
  ghost: "psychic",
};

export function starterPrimaryEnergy(pokemon: CompanionPokemon): EnergyType {
  const primary = pokemon.types[0]?.toLowerCase() ?? "electric";
  return TYPE_TO_ENERGY[primary] ?? "electric";
}
