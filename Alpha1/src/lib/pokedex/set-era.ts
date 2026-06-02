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
  mid: "2007–2021 · Diamond Pearl through early Sword & Shield",
  modern: "2022 onward · late SWSH, Scarlet & Violet, and beyond",
};

/** Canonical `YYYY/MM/DD` for lexicographic compare (API format). DB rows often use ISO dashes. */
export function normalizeSetReleaseDate(date: string | null | undefined): string {
  if (!date?.trim()) return "";
  const normalized = date.trim().replace(/-/g, "/");
  const match = normalized.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!match) return normalized;
  const [, year, month, day] = match;
  return `${year}/${month.padStart(2, "0")}/${day.padStart(2, "0")}`;
}

/** `releaseDate` is `YYYY/MM/DD`; lexicographic compare matches chronological order. */
function releaseDateInWindow(date: string, start: string, end: string): boolean {
  const d = normalizeSetReleaseDate(date);
  if (!d) return false;
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
      return releaseDateInWindow(releaseDate, "2007/01/01", "2021/12/31");
    case "modern":
      return releaseDateInWindow(releaseDate, "2022/01/01", "2100/12/31");
  }
}

/**
 * Pokémon TCG API `orderBy` for sets list within the selected era.
 */
export function setEraToOrderBy(era: SetEraId): string {
  /** Vintage: chronological (Base → …). Mid / Modern: newest in window first. */
  return era === "vintage" ? "releaseDate" : "-releaseDate";
}
