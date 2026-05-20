import type { ExtractedCard } from "@/lib/scan/schemas";

function compact(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Card Ladder path segments: lowercase, hyphen-separated, alnum only. */
export function slugifyLadderSegment(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Leading card # from "3/110", "#3", "03". */
export function cardLadderNumberHead(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  const m = raw.trim().match(/^#?\s*(\d+[a-z]?)/i);
  if (!m) return null;
  let n = m[1];
  if (/^\d+$/.test(n)) n = String(parseInt(n, 10));
  return n.toLowerCase();
}

/** PSA numeric fragment for `/ladder/card/...-psa-N`. */
export function normalizePsaSlugGrade(grade: string | undefined): string | null {
  if (!grade?.trim()) return null;
  const m = grade.trim().match(/^(\d{1,2})/);
  return m ? m[1] : null;
}

function ladderNameSetTail(card: ExtractedCard, nameSlug: string, numHead: string): string {
  const hay = `${card.printStamps ?? ""} ${card.details ?? ""} ${card.rarity ?? ""}`.toLowerCase();
  if (/reverse\s*(holo|foil|hol\s*foil)/.test(hay) || /\breverse\b/i.test(card.rarity ?? "")) {
    return `${nameSlug}-reverse-holo-${numHead}`;
  }
  if (/\bholo\b/.test(hay) && !/reverse/.test(hay)) return `${nameSlug}-holo-${numHead}`;
  return `${nameSlug}-${numHead}`;
}

export function buildCardLadderLadderSearchUrl(searchQuery: string): string {
  const q = searchQuery.trim() || "Pokemon";
  return `https://www.cardladder.com/ladder?query=${encodeURIComponent(q)}&category=Pokemon`;
}

export function cardLadderLadderSearchQuery(card: ExtractedCard): string {
  const base = compact([card.year, card.set, card.printedName, card.name, card.language]);
  const deep = buildCardLadderCardPageUrl(card);
  if (deep) return base;
  const g = card.grader?.trim().toUpperCase();
  const gradeNorm = normalizePsaSlugGrade(card.grade);
  if (g === "PSA" && gradeNorm) return compact([base, `PSA ${gradeNorm}`]);
  if (g && card.grade?.trim()) return compact([base, `${g} ${card.grade.trim()}`]);
  return base || compact([card.printedName, card.name, card.language, card.set, card.number]);
}

/** PSA `/ladder/card/...` URL when year, set, name, #, and grade support Card Ladder’s slug pattern. */
export function buildCardLadderCardPageUrl(card: ExtractedCard): string | null {
  if (card.grader?.trim().toUpperCase() !== "PSA") return null;
  const psa = normalizePsaSlugGrade(card.grade);
  if (!psa) return null;
  const year = card.year?.trim();
  if (!year || !/^\d{4}$/.test(year)) return null;
  const setName = card.set?.trim();
  const name = card.name?.trim();
  if (!setName || !name) return null;
  const numHead = cardLadderNumberHead(card.number);
  if (!numHead) return null;

  const setSlug = slugifyLadderSegment(setName);
  const nameSlug = slugifyLadderSegment(name);
  if (!setSlug || !nameSlug) return null;

  const tail = ladderNameSetTail(card, nameSlug, numHead);
  const slug = `${year}-pokemon-${setSlug}-${tail}-psa-${psa}`;
  return `https://www.cardladder.com/ladder/card/${slug}`;
}

export function cardLadderHubUrls(card: ExtractedCard): { sold: string; active: string } {
  const deep = buildCardLadderCardPageUrl(card);
  if (deep) return { sold: deep, active: deep };
  const q = cardLadderLadderSearchQuery(card);
  const u = buildCardLadderLadderSearchUrl(q);
  return { sold: u, active: u };
}
