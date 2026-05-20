import { classifyCardLane } from "@/lib/scan/lane";
import type { ExtractedCard } from "@/lib/scan/schemas";

const GRADER_PATTERN = /\b(PSA|CGC|BGS|BVG|SGC)\b/i;
const GRADE_NUM_PATTERN = /\b(10|9\.5|9|8\.5|8|7\.5|7|6\.5|6|5\.5|5|4|3|2|1)\b/;
const CERT_DIGITS_PATTERN = /\b(\d{6,12})\b/;

function cleanText(value: string | undefined | null): string {
  return String(value ?? "").trim();
}

function extractGrader(text: string): string | undefined {
  const match = text.match(GRADER_PATTERN);
  return match?.[1]?.toUpperCase();
}

function extractGradeNumber(text: string): string | undefined {
  if (/gem\s*mint/i.test(text)) return "10";
  if (/NM[-/]?MT/i.test(text)) return "8";
  const match = text.match(GRADE_NUM_PATTERN);
  return match?.[1];
}

function extractCertDigits(...sources: string[]): string | undefined {
  for (const source of sources) {
    const digits = source.replace(/\D/g, "");
    if (digits.length >= 6) return digits;
    const match = source.match(CERT_DIGITS_PATTERN);
    if (match?.[1]) return match[1];
  }
  return undefined;
}

/** Normalize grader / grade / cert from label text when vision splits fields unevenly. */
export function normalizeGradedSlabFields(
  card: ExtractedCard,
  laneHint?: "raw" | "graded",
): ExtractedCard {
  const lane = laneHint ?? classifyCardLane(card).lane;
  if (lane !== "graded") return card;

  const blobs = [
    cleanText(card.grade),
    cleanText(card.grader),
    cleanText(card.labelTitle),
    cleanText(card.rarity),
    cleanText(card.details),
    cleanText(card.cert),
  ].filter(Boolean);

  let grader = cleanText(card.grader);
  let grade = cleanText(card.grade);
  let cert = cleanText(card.cert);

  for (const blob of blobs) {
    const combined = blob.match(
      /\b(PSA|CGC|BGS|BVG|SGC)\s*([0-9]{1,2}(?:\.[0-9])?|GEM\s*MINT|NM[-/]?MT)\b/i,
    );
    if (combined) {
      grader = grader || combined[1]!.toUpperCase();
      if (!grade || !GRADE_NUM_PATTERN.test(grade)) {
        grade = extractGradeNumber(combined[2]!) ?? grade;
      }
    }
    if (!grader) {
      const g = extractGrader(blob);
      if (g) grader = g;
    }
    if (!grade || !GRADE_NUM_PATTERN.test(grade)) {
      const n = extractGradeNumber(blob);
      if (n) grade = n;
    }
  }

  const certDigits = extractCertDigits(cert, ...blobs);
  if (certDigits) cert = certDigits;

  const gradeSplit = grade.match(/^(PSA|CGC|BGS|BVG|SGC)\s+(.+)$/i);
  if (gradeSplit) {
    grader = grader || gradeSplit[1]!.toUpperCase();
    grade = gradeSplit[2]!.trim();
  }

  return {
    ...card,
    grader: grader || undefined,
    grade: grade || undefined,
    cert: cert || undefined,
    encapsulation: card.encapsulation || "graded_slab",
  };
}

type SlabTagInput = Pick<
  ExtractedCard,
  "grader" | "grade" | "cert" | "encapsulation" | "labelTitle" | "rarity" | "details"
> & { name?: string };

export function formatGradedSlabTag(
  card: SlabTagInput,
  laneHint?: "raw" | "graded",
): string | null {
  const lane =
    laneHint ??
    classifyCardLane({
      ...card,
      name: card.name ?? "Card",
    } as ExtractedCard).lane;
  if (lane !== "graded") return null;

  const grader = cleanText(card.grader);
  const grade = cleanText(card.grade);
  const certDigits = cleanText(card.cert).replace(/\D/g, "");

  const parts: string[] = [];
  if (grader && grade) parts.push(`${grader} ${grade}`);
  else if (grader) parts.push(grader);
  else if (grade) parts.push(grade);

  if (certDigits.length >= 6) parts.push(`#${certDigits}`);

  return parts.length > 0 ? parts.join(" · ") : null;
}
