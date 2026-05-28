import { classifyCardLane } from "@/lib/scan/lane";
import { franchiseSearchPrefix } from "@/lib/scan/franchise";
import { isJapanesePokemonCard, japaneseMarketIdentityParts } from "@/lib/scan/japanese-pokemon";
import type { ExtractedCard } from "@/lib/scan/schemas";

export function compact(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Numeric grade for search keywords (Mint 9 → 9, Gem Mint → 10). */
export function extractNumericGrade(grade: string | undefined | null): string | null {
  if (!grade?.trim()) return null;
  const g = grade.trim();
  if (/black\s*label/i.test(g)) return "10";
  if (/gem\s*mint|pristine/i.test(g) && !/\b[0-9]/.test(g)) return "10";
  const m = g.match(/\b(10|9\.5|9|8\.5|8|7\.5|7|6\.5|6|5\.5|5|4|3|2|1)\b/);
  return m?.[1] ?? null;
}

/**
 * eBay-style grader label: `PSA 9`, `CGC 10`, `BGS Black Label` (not `PSA Mint 9`).
 * Matches queries users verify on eBay sold search.
 */
export function formatGraderGradeLabel(
  grader: string | undefined | null,
  grade: string | undefined | null,
): string | null {
  const g = grader?.trim().toUpperCase();
  const raw = grade?.trim() ?? "";
  if (!g) return null;

  if (/black\s*label/i.test(raw)) {
    if (g.includes("BGS") || g.includes("BECKETT")) return "BGS Black Label";
    return `${g} Black Label`;
  }
  if (/pristine/i.test(raw) && g.includes("CGC")) return "CGC Pristine 10";

  const num = extractNumericGrade(raw);
  if (num) return `${g} ${num}`;
  if (/gem\s*mint/i.test(raw)) return `${g} 10`;
  return compact([g, raw]) || null;
}

export type MarketSearchIdentity = {
  /** Raw / NM search identity */
  raw: string;
  /** Graded slab identity (name, set, rarity, year, grader grade) */
  graded: string;
  /** Primary eBay sold query (verified pattern: Pokemon Name Set Rarity Year PSA 9) */
  ebayPrimary: string;
  /** Card Ladder / ALT style query */
  platform: string;
  gradeLabel: string | null;
};

/**
 * Build search strings used consistently for eBay sold scrape, hub links, ALT, Card Ladder, Goldin.
 */
export function buildMarketSearchIdentity(card: ExtractedCard): MarketSearchIdentity {
  const prefix = franchiseSearchPrefix(card);
  const lane = classifyCardLane(card as Record<string, unknown>).lane;
  const gradeLabel = formatGraderGradeLabel(card.grader, card.grade);
  const japanese = isJapanesePokemonCard(card);
  const japaneseParts = japaneseMarketIdentityParts(card);

  const head = compact([
    prefix,
    ...(japanese ? japaneseParts : [card.name, card.printedName, card.set]),
    card.rarity,
    japanese ? null : card.year,
  ]);

  const graded = compact([
    prefix,
    ...(japanese ? japaneseParts : [card.name, card.set]),
    card.rarity,
    japanese ? null : card.year,
    gradeLabel,
  ]);

  const certDigits = card.cert?.replace(/\D/g, "") ?? "";
  const certBit =
    certDigits.length >= 6 && card.grader?.trim()
      ? `${card.grader.trim()} ${certDigits}`
      : null;

  const platform = compact([graded || head, certBit]);

  const ebayPrimary =
    lane === "graded" && gradeLabel
      ? compact([prefix, ...(japanese ? japaneseParts : [card.name, card.set]), card.rarity, japanese ? null : card.year, gradeLabel, japanese ? "sold" : null])
      : head;

  return {
    raw: head,
    graded: graded || head,
    ebayPrimary: ebayPrimary || head,
    platform: platform || head,
    gradeLabel,
  };
}
