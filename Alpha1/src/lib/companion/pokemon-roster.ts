export type CompanionTier = "starter" | "eevee" | "legendary" | "mythical";

export type CompanionPokemon = {
  id: number;
  name: string;
  /** Pokémon Showdown animated sprite slug */
  slug: string;
  tier: CompanionTier;
  era: string;
  types: string[];
};

/** Curated hatch pool — fan-made companion roster (PokeAPI / Showdown sprites). */
export const COMPANION_ROSTER: CompanionPokemon[] = [
  // Gen I starters + mascot
  { id: 1, name: "Bulbasaur", slug: "bulbasaur", tier: "starter", era: "Kanto", types: ["grass", "poison"] },
  { id: 4, name: "Charmander", slug: "charmander", tier: "starter", era: "Kanto", types: ["fire"] },
  { id: 7, name: "Squirtle", slug: "squirtle", tier: "starter", era: "Kanto", types: ["water"] },
  { id: 25, name: "Pikachu", slug: "pikachu", tier: "starter", era: "Kanto", types: ["electric"] },
  // Gen II
  { id: 152, name: "Chikorita", slug: "chikorita", tier: "starter", era: "Johto", types: ["grass"] },
  { id: 155, name: "Cyndaquil", slug: "cyndaquil", tier: "starter", era: "Johto", types: ["fire"] },
  { id: 158, name: "Totodile", slug: "totodile", tier: "starter", era: "Johto", types: ["water"] },
  // Gen III
  { id: 252, name: "Treecko", slug: "treecko", tier: "starter", era: "Hoenn", types: ["grass"] },
  { id: 255, name: "Torchic", slug: "torchic", tier: "starter", era: "Hoenn", types: ["fire"] },
  { id: 258, name: "Mudkip", slug: "mudkip", tier: "starter", era: "Hoenn", types: ["water"] },
  // Gen IV
  { id: 387, name: "Turtwig", slug: "turtwig", tier: "starter", era: "Sinnoh", types: ["grass"] },
  { id: 390, name: "Chimchar", slug: "chimchar", tier: "starter", era: "Sinnoh", types: ["fire"] },
  { id: 393, name: "Piplup", slug: "piplup", tier: "starter", era: "Sinnoh", types: ["water"] },
  // Gen V
  { id: 495, name: "Snivy", slug: "snivy", tier: "starter", era: "Unova", types: ["grass"] },
  { id: 498, name: "Tepig", slug: "tepig", tier: "starter", era: "Unova", types: ["fire"] },
  { id: 501, name: "Oshawott", slug: "oshawott", tier: "starter", era: "Unova", types: ["water"] },
  // Gen VI
  { id: 650, name: "Chespin", slug: "chespin", tier: "starter", era: "Kalos", types: ["grass"] },
  { id: 653, name: "Fennekin", slug: "fennekin", tier: "starter", era: "Kalos", types: ["fire"] },
  { id: 656, name: "Froakie", slug: "froakie", tier: "starter", era: "Kalos", types: ["water"] },
  // Gen VII
  { id: 722, name: "Rowlet", slug: "rowlet", tier: "starter", era: "Alola", types: ["grass", "flying"] },
  { id: 725, name: "Litten", slug: "litten", tier: "starter", era: "Alola", types: ["fire"] },
  { id: 728, name: "Popplio", slug: "popplio", tier: "starter", era: "Alola", types: ["water"] },
  // Gen VIII
  { id: 810, name: "Grookey", slug: "grookey", tier: "starter", era: "Galar", types: ["grass"] },
  { id: 813, name: "Scorbunny", slug: "scorbunny", tier: "starter", era: "Galar", types: ["fire"] },
  { id: 816, name: "Sobble", slug: "sobble", tier: "starter", era: "Galar", types: ["water"] },
  // Gen IX
  { id: 906, name: "Sprigatito", slug: "sprigatito", tier: "starter", era: "Paldea", types: ["grass"] },
  { id: 909, name: "Fuecoco", slug: "fuecoco", tier: "starter", era: "Paldea", types: ["fire"] },
  { id: 912, name: "Quaxly", slug: "quaxly", tier: "starter", era: "Paldea", types: ["water"] },

  // Eevee line
  { id: 133, name: "Eevee", slug: "eevee", tier: "eevee", era: "Kanto", types: ["normal"] },
  { id: 134, name: "Vaporeon", slug: "vaporeon", tier: "eevee", era: "Kanto", types: ["water"] },
  { id: 135, name: "Jolteon", slug: "jolteon", tier: "eevee", era: "Kanto", types: ["electric"] },
  { id: 136, name: "Flareon", slug: "flareon", tier: "eevee", era: "Kanto", types: ["fire"] },
  { id: 196, name: "Espeon", slug: "espeon", tier: "eevee", era: "Johto", types: ["psychic"] },
  { id: 197, name: "Umbreon", slug: "umbreon", tier: "eevee", era: "Johto", types: ["dark"] },
  { id: 470, name: "Leafeon", slug: "leafeon", tier: "eevee", era: "Sinnoh", types: ["grass"] },
  { id: 471, name: "Glaceon", slug: "glaceon", tier: "eevee", era: "Sinnoh", types: ["ice"] },
  { id: 700, name: "Sylveon", slug: "sylveon", tier: "eevee", era: "Kalos", types: ["fairy"] },

  // Legendary birds + classics
  { id: 144, name: "Articuno", slug: "articuno", tier: "legendary", era: "Kanto", types: ["ice", "flying"] },
  { id: 145, name: "Zapdos", slug: "zapdos", tier: "legendary", era: "Kanto", types: ["electric", "flying"] },
  { id: 146, name: "Moltres", slug: "moltres", tier: "legendary", era: "Kanto", types: ["fire", "flying"] },
  { id: 150, name: "Mewtwo", slug: "mewtwo", tier: "mythical", era: "Kanto", types: ["psychic"] },
  { id: 151, name: "Mew", slug: "mew", tier: "mythical", era: "Kanto", types: ["psychic"] },
  { id: 243, name: "Raikou", slug: "raikou", tier: "legendary", era: "Johto", types: ["electric"] },
  { id: 244, name: "Entei", slug: "entei", tier: "legendary", era: "Johto", types: ["fire"] },
  { id: 245, name: "Suicune", slug: "suicune", tier: "legendary", era: "Johto", types: ["water"] },
  { id: 249, name: "Lugia", slug: "lugia", tier: "legendary", era: "Johto", types: ["psychic", "flying"] },
  { id: 250, name: "Ho-Oh", slug: "hooh", tier: "legendary", era: "Johto", types: ["fire", "flying"] },
  { id: 251, name: "Celebi", slug: "celebi", tier: "mythical", era: "Johto", types: ["psychic", "grass"] },
  { id: 377, name: "Regirock", slug: "regirock", tier: "legendary", era: "Hoenn", types: ["rock"] },
  { id: 378, name: "Regice", slug: "regice", tier: "legendary", era: "Hoenn", types: ["ice"] },
  { id: 379, name: "Registeel", slug: "registeel", tier: "legendary", era: "Hoenn", types: ["steel"] },
  { id: 380, name: "Latias", slug: "latias", tier: "legendary", era: "Hoenn", types: ["dragon", "psychic"] },
  { id: 381, name: "Latios", slug: "latios", tier: "legendary", era: "Hoenn", types: ["dragon", "psychic"] },
  { id: 382, name: "Kyogre", slug: "kyogre", tier: "legendary", era: "Hoenn", types: ["water"] },
  { id: 383, name: "Groudon", slug: "groudon", tier: "legendary", era: "Hoenn", types: ["ground"] },
  { id: 384, name: "Rayquaza", slug: "rayquaza", tier: "legendary", era: "Hoenn", types: ["dragon", "flying"] },
  { id: 385, name: "Jirachi", slug: "jirachi", tier: "mythical", era: "Hoenn", types: ["steel", "psychic"] },
  { id: 386, name: "Deoxys", slug: "deoxys", tier: "mythical", era: "Hoenn", types: ["psychic"] },
  { id: 480, name: "Uxie", slug: "uxie", tier: "legendary", era: "Sinnoh", types: ["psychic"] },
  { id: 481, name: "Mesprit", slug: "mesprit", tier: "legendary", era: "Sinnoh", types: ["psychic"] },
  { id: 482, name: "Azelf", slug: "azelf", tier: "legendary", era: "Sinnoh", types: ["psychic"] },
  { id: 483, name: "Dialga", slug: "dialga", tier: "legendary", era: "Sinnoh", types: ["steel", "dragon"] },
  { id: 484, name: "Palkia", slug: "palkia", tier: "legendary", era: "Sinnoh", types: ["water", "dragon"] },
  { id: 487, name: "Giratina", slug: "giratina", tier: "legendary", era: "Sinnoh", types: ["ghost", "dragon"] },
  { id: 488, name: "Cresselia", slug: "cresselia", tier: "legendary", era: "Sinnoh", types: ["psychic"] },
  { id: 493, name: "Arceus", slug: "arceus", tier: "mythical", era: "Sinnoh", types: ["normal"] },
  { id: 643, name: "Reshiram", slug: "reshiram", tier: "legendary", era: "Unova", types: ["dragon", "fire"] },
  { id: 644, name: "Zekrom", slug: "zekrom", tier: "legendary", era: "Unova", types: ["dragon", "electric"] },
  { id: 646, name: "Kyurem", slug: "kyurem", tier: "legendary", era: "Unova", types: ["dragon", "ice"] },
  { id: 716, name: "Xerneas", slug: "xerneas", tier: "legendary", era: "Kalos", types: ["fairy"] },
  { id: 717, name: "Yveltal", slug: "yveltal", tier: "legendary", era: "Kalos", types: ["dark", "flying"] },
  { id: 718, name: "Zygarde", slug: "zygarde", tier: "legendary", era: "Kalos", types: ["dragon", "ground"] },
  { id: 791, name: "Solgaleo", slug: "solgaleo", tier: "legendary", era: "Alola", types: ["psychic", "steel"] },
  { id: 792, name: "Lunala", slug: "lunala", tier: "legendary", era: "Alola", types: ["psychic", "ghost"] },
  { id: 800, name: "Necrozma", slug: "necrozma", tier: "legendary", era: "Alola", types: ["psychic"] },
  { id: 888, name: "Zacian", slug: "zacian", tier: "legendary", era: "Galar", types: ["fairy"] },
  { id: 889, name: "Zamazenta", slug: "zamazenta", tier: "legendary", era: "Galar", types: ["fighting"] },
  { id: 890, name: "Eternatus", slug: "eternatus", tier: "legendary", era: "Galar", types: ["poison", "dragon"] },
  { id: 1007, name: "Koraidon", slug: "koraidon", tier: "legendary", era: "Paldea", types: ["fighting", "dragon"] },
  { id: 1008, name: "Miraidon", slug: "miraidon", tier: "legendary", era: "Paldea", types: ["electric", "dragon"] },
];

const TIER_WEIGHT: Record<CompanionTier, number> = {
  starter: 42,
  eevee: 18,
  legendary: 28,
  mythical: 12,
};

const rosterById = new Map(COMPANION_ROSTER.map((p) => [p.id, p]));

export function getCompanionPokemon(id: number): CompanionPokemon | null {
  return rosterById.get(id) ?? null;
}

export function pickRandomCompanionPokemon(): CompanionPokemon {
  const total = COMPANION_ROSTER.reduce((sum, p) => sum + TIER_WEIGHT[p.tier], 0);
  let roll = Math.random() * total;
  for (const pokemon of COMPANION_ROSTER) {
    roll -= TIER_WEIGHT[pokemon.tier];
    if (roll <= 0) return pokemon;
  }
  return COMPANION_ROSTER[0]!;
}

/** Fisher–Yates shuffle for pokeball grid positions (indices 0–8). */
export function shufflePokeballGrid(): number[] {
  const indices = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j]!, indices[i]!];
  }
  return indices;
}
