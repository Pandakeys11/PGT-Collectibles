import type { ExtractedCard } from "@/lib/scan/schemas";

function haystack(card: Pick<ExtractedCard, "franchise" | "name" | "printedName" | "set" | "details" | "printStamps" | "rarity" | "labelTitle">): string {
  return [
    card.franchise,
    card.name,
    card.printedName,
    card.set,
    card.details,
    card.printStamps,
    card.rarity,
    card.labelTitle,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Pokemon-branded collectible cards that are not in the Pokemon TCG API spine.
 * Avoid using regular TCG catalog art for these rows.
 */
export function isNonTcgPokemonCollectible(
  card: Pick<ExtractedCard, "franchise" | "name" | "printedName" | "set" | "details" | "printStamps" | "rarity" | "labelTitle">,
): boolean {
  const h = haystack(card);
  if (!h) return false;
  return (
    /\bsealdass\b|\bcarddass\b|\btopsun\b|\bmeiji\b/.test(h) ||
    /\btopps\b.*\bpokemon\b|\bpokemon\b.*\btopps\b/.test(h) ||
    /\bmovie edition\b/.test(h) ||
    /\bpocket monsters\b.*\bseries\s*[1-9]\b/.test(h)
  );
}
