import {
  buildMarketSearchIdentity,
  editionLabelForMarketSearch,
} from "@/lib/market/market-search-identity";
import type { ExtractedCard } from "@/lib/scan/schemas";
import { inferCardFranchise } from "@/lib/scan/franchise";
import { resolvePrintEdition } from "@/lib/scan/print-edition";

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

function ladderEditionSlug(card: ExtractedCard): string {
  const edition = resolvePrintEdition(card);
  if (edition?.id === "unlimited") return "unlimited";
  if (edition?.id === "first_edition") return "1st-edition";
  if (edition?.id === "shadowless") return "shadowless";
  const hay = `${card.printStamps ?? ""} ${card.details ?? ""}`.toLowerCase();
  if (/unlimited/.test(hay)) return "unlimited";
  if (/1st\s*edition|first\s*edition/.test(hay)) return "1st-edition";
  if (/shadowless/.test(hay)) return "shadowless";
  return "";
}

function ladderNameSetTail(card: ExtractedCard, nameSlug: string, numHead: string): string {
  const editionPart = ladderEditionSlug(card);
  const editionSeg = editionPart ? `${editionPart}-` : "";
  const hay = `${card.printStamps ?? ""} ${card.details ?? ""} ${card.rarity ?? ""}`.toLowerCase();
  if (/reverse\s*(holo|foil|hol\s*foil)/.test(hay) || /\breverse\b/i.test(card.rarity ?? "")) {
    return `${nameSlug}-${editionSeg}reverse-holo-${numHead}`;
  }
  if (/\bholo\b/.test(hay) && !/reverse/.test(hay)) return `${nameSlug}-${editionSeg}holo-${numHead}`;
  return `${nameSlug}-${editionSeg}${numHead}`;
}

export function buildCardLadderLadderSearchUrl(searchQuery: string): string {
  const q = searchQuery.trim() || "Pokemon";
  return `https://www.cardladder.com/ladder?query=${encodeURIComponent(q)}&category=Pokemon`;
}

function buildCardLadderSearchUrlForCard(card: ExtractedCard, searchQuery: string): string {
  const q = searchQuery.trim() || card.name || "trading card";
  const params = new URLSearchParams({ query: q });
  if (inferCardFranchise(card).isPokemon) params.set("category", "Pokemon");
  return `https://www.cardladder.com/ladder?${params.toString()}`;
}

export function cardLadderLadderSearchQuery(card: ExtractedCard): string {
  const identity = buildMarketSearchIdentity(card);
  const deep = buildCardLadderCardPageUrl(card);
  if (deep) {
    return compact([
      card.year,
      card.set,
      card.name,
      editionLabelForMarketSearch(card),
      identity.gradeLabel,
    ]);
  }
  return identity.platform || identity.graded || identity.raw;
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
  const u = buildCardLadderSearchUrlForCard(card, q);
  return { sold: u, active: u };
}

/**
 * Best-effort cert search URL (Card Ladder UI also has a # cert dialog).
 * Query embeds grader + cert so users land on sales history for that slab class.
 */
export function buildCardLadderSearchUrlForCert(
  grader: string,
  cert: string,
  category?: string,
): string {
  const digits = cert.replace(/\D/g, "");
  const q = `${grader.trim()} ${digits}`.trim();
  const params = new URLSearchParams({ query: q });
  if (category) params.set("category", category);
  else params.set("category", "Pokemon");
  return `https://www.cardladder.com/ladder?${params.toString()}`;
}
