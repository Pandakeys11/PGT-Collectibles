/**
 * Pokémon TCG API set list: era filters (releaseDate is YYYY/MM/DD on sets).
 * @see https://docs.pokemontcg.io/api-reference/sets/set-object/
 */

export type SetEraId = "vintage" | "mid" | "modern";

export const SET_ERA_ORDER: SetEraId[] = ["vintage", "mid", "modern"];

export const SET_ERA_LABEL: Record<SetEraId, string> = {
  vintage: "Vintage",
  mid: "Mid-Era",
  modern: "Modern",
};

/** Short helper line under era control */
export const SET_ERA_DESCRIPTION: Record<SetEraId, string> = {
  vintage: "Through 2006 · Wizards & early Nintendo",
  mid: "2007–2022 · Diamond Pearl through Sword & Shield",
  modern: "2023 onward · Scarlet & Violet era",
};

/** `releaseDate` is `YYYY/MM/DD` from the API; lexicographic compare matches chronological order. */
function releaseDateInWindow(date: string, start: string, end: string): boolean {
  const d = date.trim();
  return d >= start && d <= end;
}

/**
 * Whether a set’s `releaseDate` falls in the era window.
 * Note: `/v2/sets` rejects Lucene range queries on `releaseDate` (400), so we filter after fetch.
 */
export function setMatchesEra(releaseDate: string | undefined, era: SetEraId): boolean {
  if (!releaseDate?.trim()) return false;
  switch (era) {
    case "vintage":
      return releaseDateInWindow(releaseDate, "1998/01/01", "2006/12/31");
    case "mid":
      return releaseDateInWindow(releaseDate, "2007/01/01", "2022/12/31");
    case "modern":
      return releaseDateInWindow(releaseDate, "2023/01/01", "2100/12/31");
  }
}

/**
 * Pokémon TCG API `orderBy` for sets list within the selected era.
 */
export function setEraToOrderBy(era: SetEraId): string {
  /** Vintage: chronological (Base → …). Mid / Modern: newest in window first. */
  return era === "vintage" ? "releaseDate" : "-releaseDate";
}
