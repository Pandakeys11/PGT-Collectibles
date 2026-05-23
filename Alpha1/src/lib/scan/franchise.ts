import type { ExtractedCard } from "@/lib/scan/schemas";

export type CardFranchise =
  | "pokemon"
  | "onepiece"
  | "dragonball"
  | "sports"
  | "yugioh"
  | "magic"
  | "lorcana"
  | "other";

export type FranchiseProfile = {
  id: CardFranchise;
  label: string;
  searchTerms: string[];
  isPokemon: boolean;
  isTcg: boolean;
};

const PROFILES: Record<CardFranchise, FranchiseProfile> = {
  pokemon: {
    id: "pokemon",
    label: "Pokemon",
    searchTerms: ["Pokemon", "Pokemon TCG"],
    isPokemon: true,
    isTcg: true,
  },
  onepiece: {
    id: "onepiece",
    label: "One Piece",
    searchTerms: ["One Piece Card Game", "One Piece TCG"],
    isPokemon: false,
    isTcg: true,
  },
  dragonball: {
    id: "dragonball",
    label: "Dragon Ball",
    searchTerms: ["Dragon Ball Super Card Game", "Dragon Ball Z card"],
    isPokemon: false,
    isTcg: true,
  },
  sports: {
    id: "sports",
    label: "Sports",
    searchTerms: ["sports card", "trading card"],
    isPokemon: false,
    isTcg: false,
  },
  yugioh: {
    id: "yugioh",
    label: "Yu-Gi-Oh!",
    searchTerms: ["Yu-Gi-Oh card", "Yugioh TCG"],
    isPokemon: false,
    isTcg: true,
  },
  magic: {
    id: "magic",
    label: "Magic",
    searchTerms: ["Magic the Gathering", "MTG card"],
    isPokemon: false,
    isTcg: true,
  },
  lorcana: {
    id: "lorcana",
    label: "Lorcana",
    searchTerms: ["Disney Lorcana", "Lorcana TCG"],
    isPokemon: false,
    isTcg: true,
  },
  other: {
    id: "other",
    label: "Collectible",
    searchTerms: ["trading card", "collectible card"],
    isPokemon: false,
    isTcg: false,
  },
};

function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

function haystack(card: ExtractedCard): string {
  return normalize(
    [
      card.franchise,
      card.name,
      card.printedName,
      card.set,
      card.details,
      card.printStamps,
      card.rarity,
      card.labelTitle,
    ].join(" "),
  );
}

export function inferCardFranchise(card: ExtractedCard): FranchiseProfile {
  const explicit = normalize(card.franchise);
  if (/pokemon|pocket monsters/.test(explicit)) return PROFILES.pokemon;
  if (/one\s*piece/.test(explicit)) return PROFILES.onepiece;
  if (/dragon\s*ball|dragonball|dbz|dbs/.test(explicit)) return PROFILES.dragonball;
  if (/yu-?gi-?oh|yugioh/.test(explicit)) return PROFILES.yugioh;
  if (/magic|mtg/.test(explicit)) return PROFILES.magic;
  if (/lorcana/.test(explicit)) return PROFILES.lorcana;
  if (/sport|baseball|basketball|football|soccer|hockey|ufc|wwe|formula|f1|racing/.test(explicit)) {
    return PROFILES.sports;
  }

  const h = haystack(card);
  if (/pokemon|pikachu|charizard|mewtwo|eevee|trainer gallery|pokeball|poke ball/.test(h)) {
    return PROFILES.pokemon;
  }
  if (/one\s*piece|monkey\s*d\.?\s*luffy|roronoa|nami|kaido|yamato|op-\d|op\d|romance dawn/.test(h)) {
    return PROFILES.onepiece;
  }
  if (/dragon\s*ball|dragonball|dbz|dbs|goku|vegeta|frieza|gohan|broly|beerus/.test(h)) {
    return PROFILES.dragonball;
  }
  if (/yu-?gi-?oh|yugioh|blue-eyes|dark magician|starlight rare|ghost rare/.test(h)) {
    return PROFILES.yugioh;
  }
  if (/magic the gathering|\bmtg\b|planeswalker|commander|mana|foil etched/.test(h)) {
    return PROFILES.magic;
  }
  if (/lorcana|enchanted rare|inklands|ursula|mickey mouse|stitch/.test(h)) {
    return PROFILES.lorcana;
  }
  if (
    /topps|panini|upper deck|donruss|prizm|optic|select|bowman|rookie|autograph|auto\b|relic|patch|jersey|baseball|basketball|football|soccer|hockey|ufc|wwe|f1|formula 1/.test(
      h,
    )
  ) {
    return PROFILES.sports;
  }
  return PROFILES.other;
}

export function franchiseLabel(card: ExtractedCard): string {
  return inferCardFranchise(card).label;
}

export function franchiseSearchPrefix(card: ExtractedCard): string {
  const profile = inferCardFranchise(card);
  return profile.searchTerms[0] ?? profile.label;
}
