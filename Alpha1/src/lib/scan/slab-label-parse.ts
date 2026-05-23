import type { ExtractedCard } from "@/lib/scan/schemas";

const GRADER_PATTERN = /\b(PSA|CGC|BGS|BVG|SGC|ACE|TAG)\b/i;

/** Parse year · set · collector # · name from a PSA/CGC front label line. */
export function parseStructuredSlabLabel(
  labelTitle: string | undefined | null,
): Partial<Pick<ExtractedCard, "year" | "set" | "number" | "name" | "grader" | "grade">> {
  const raw = labelTitle?.trim();
  if (!raw || raw.length < 8) return {};

  const out: Partial<Pick<ExtractedCard, "year" | "set" | "number" | "name" | "grader" | "grade">> = {};

  const yearMatch = raw.match(/\b(19\d{2}|20\d{2})\b/);
  if (yearMatch) out.year = yearMatch[1];

  const graderMatch = raw.match(GRADER_PATTERN);
  if (graderMatch) out.grader = graderMatch[1]!.toUpperCase();

  const gradeMatch = raw.match(
    /\b(?:PSA|CGC|BGS|BVG|SGC|ACE|TAG)\s+(\d{1,2}(?:\.\d)?|GEM\s*MINT|NM[-/]?MT)\b/i,
  );
  if (gradeMatch) {
    const g = gradeMatch[1]!.toUpperCase();
    out.grade = /GEM\s*MINT/i.test(g) ? "10" : /NM[-/]?MT/i.test(g) ? "8" : gradeMatch[1]!;
  } else {
    const loneGrade = raw.match(/\b(10|9\.5|9|8\.5|8|7\.5|7)\b/);
    if (loneGrade && graderMatch) out.grade = loneGrade[1];
  }

  const fraction = raw.match(/#?\s*(\d{1,3})\s*\/\s*(\d{1,3})\b/);
  if (fraction) {
    out.number = `${fraction[1]}/${fraction[2]}`;
  } else {
    const hashNum = raw.match(/#\s*(\d{1,3})\b/);
    if (hashNum) out.number = hashNum[1]!;
  }

  const setPatterns = [
    /\bPOKEMON\s+([A-Z0-9][A-Z0-9\s.'-]+?)(?:\s+-\s+|\s+1ST|\s+UNLIMITED|\s+#|\s+\d{1,3}\s*\/|\s*$)/i,
    /\bP\.?\s*M\.?\s+([A-Z][A-Z0-9\s.'-]+?)(?:\s+-\s+|\s+#|\s+\d{1,3}\s*\/|\s*$)/i,
  ];
  for (const pattern of setPatterns) {
    const m = raw.match(pattern);
    if (m?.[1]?.trim()) {
      let setName = m[1].trim().replace(/\s+/g, " ");
      if (/^FOSSIL/i.test(setName)) setName = "Fossil";
      if (/^JUNGLE/i.test(setName)) setName = "Jungle";
      if (/^BASE\s*SET/i.test(setName)) setName = "Base Set";
      if (/TEAM\s*ROCKET/i.test(setName)) setName = "Team Rocket";
      if (/NEO\s*REVELATION/i.test(setName)) setName = "Neo Revelation";
      if (/NEO\s*GENESIS/i.test(setName)) setName = "Neo Genesis";
      if (/NEO\s*DISCOVERY/i.test(setName)) setName = "Neo Discovery";
      if (/GAME\b/i.test(setName)) setName = "Base Set";
      out.set = setName;
      break;
    }
  }

  if (/1ST\s*EDITION/i.test(raw) && out.set) {
    out.set = `${out.set} 1st Edition`;
  }

  const nameFromEnd = raw.match(
    /(?:#\s*\d{1,3}(?:\s*\/\s*\d{1,3})?|\d{1,3}\s*\/\s*\d{1,3})\s+([A-Za-z][A-Za-z0-9\s.'-]{2,40})$/i,
  );
  if (nameFromEnd?.[1]) {
    out.name = nameFromEnd[1].trim();
  }

  return out;
}
