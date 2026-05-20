/**
 * Pokémon Showdown `sprites/ani/{slug}.gif` slug resolution.
 * @see https://play.pokemonshowdown.com/sprites/ani/
 */

/** Roster slug → Showdown filename when they differ. */
export const SHOWDOWN_SLUG_OVERRIDES: Record<string, string> = {
  // Roster already uses Showdown ids for most entries; add exceptions here.
};

export function resolveShowdownSlug(slug: string): string {
  const trimmed = slug.trim().toLowerCase();
  return SHOWDOWN_SLUG_OVERRIDES[trimmed] ?? trimmed;
}

export function showdownAnimatedUrl(slug: string): string {
  return `https://play.pokemonshowdown.com/sprites/ani/${resolveShowdownSlug(slug)}.gif`;
}
