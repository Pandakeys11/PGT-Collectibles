import { classifyCardLane } from "@/lib/scan/lane";
import { parseStructuredSlabLabel } from "@/lib/scan/slab-label-parse";
import type { ExtractedCard } from "@/lib/scan/schemas";
import type { RegistrySnapshot } from "@/lib/scan/verification";

/** Shown when cert # is on slab back or not readable in the upload — user can type the real cert. */
export const CERT_NOT_VISIBLE = "NA";

const GRADERS = ["PSA", "CGC", "BGS", "BVG", "SGC", "ACE", "TAG", "HGA", "GMA"] as const;
const GRADER_PATTERN = new RegExp(`\\b(${GRADERS.join("|")})\\b`, "i");
const GRADE_NUM_PATTERN = /\b(10|9\.5|9|8\.5|8|7\.5|7|6\.5|6|5\.5|5|4|3|2|1)\b/;

/** Graders that usually print cert # on the back — require explicit cert labeling on front. */
const GRADERS_CERT_OFTEN_ON_BACK = new Set(["CGC", "TAG", "HGA", "GMA"]);

const EXPLICIT_CERT_LABEL =
  /(?:cert(?:ification)?|serial|barcode)\s*(?:#|no\.?|number)?\s*[:#]?\s*(\d{6,12})/i;
const HASH_CERT_LABEL = /#\s*(\d{6,12})\b/;

function cleanText(value: string | undefined | null): string {
  return String(value ?? "").trim();
}

export function isCertNotApplicable(cert: string | undefined | null): boolean {
  const c = cleanText(cert).toUpperCase();
  return !c || c === CERT_NOT_VISIBLE || c === "N/A";
}

export function hasReadableCertNumber(cert: string | undefined | null): boolean {
  if (isCertNotApplicable(cert)) return false;
  const digits = String(cert ?? "").replace(/\D/g, "");
  return digits.length >= 6 && digits.length <= 12;
}

function extractGrader(text: string): string | undefined {
  const match = text.match(GRADER_PATTERN);
  return match?.[1]?.toUpperCase();
}

function extractGradeNumber(text: string): string | undefined {
  if (/gem\s*mint|pristine|black\s*label/i.test(text)) return "10";
  if (/NM[-/]?\s*MT|near\s*mint/i.test(text)) return "8";
  if (/authentic/i.test(text) && !GRADE_NUM_PATTERN.test(text)) return undefined;
  const match = text.match(GRADE_NUM_PATTERN);
  return match?.[1];
}

function extractGradeQualifiers(text: string): string[] {
  const qualifiers: string[] = [];
  if (/gem\s*mint/i.test(text)) qualifiers.push("GEM MT");
  if (/black\s*label/i.test(text)) qualifiers.push("Black Label");
  if (/pristine/i.test(text)) qualifiers.push("Pristine");
  if (/qualifier/i.test(text)) qualifiers.push("Qualifier");
  return qualifiers;
}

/** Only accept cert digits when explicitly labeled — never mine card # / year / set codes. */
function extractExplicitCertDigits(
  ...sources: (string | undefined | null)[]
): string | undefined {
  for (const source of sources) {
    const text = cleanText(source);
    if (!text) continue;

    const labeled = text.match(EXPLICIT_CERT_LABEL);
    if (labeled?.[1]) return labeled[1];

    const hash = text.match(HASH_CERT_LABEL);
    if (hash?.[1] && /cert|serial|barcode/i.test(text)) return hash[1];

    if (/^#?\d{6,12}$/.test(text.replace(/\s/g, ""))) {
      return text.replace(/\D/g, "");
    }
  }
  return undefined;
}

function graderRequiresExplicitCert(grader: string | undefined): boolean {
  return GRADERS_CERT_OFTEN_ON_BACK.has(cleanText(grader).toUpperCase());
}

function appendUniqueDetails(
  existing: string | undefined,
  extra: string | undefined,
): string | undefined {
  if (!extra?.trim()) return existing?.trim() || undefined;
  const e = extra.trim();
  if (!existing?.trim()) return e;
  if (existing.toLowerCase().includes(e.toLowerCase())) return existing.trim();
  return `${existing.trim()} · ${e}`;
}

function slabTextBlobs(card: ExtractedCard): string[] {
  return [
    cleanText(card.labelTitle),
    cleanText(card.grade),
    cleanText(card.grader),
    cleanText(card.rarity),
    cleanText(card.details),
    cleanText(card.cert),
  ].filter(Boolean);
}

function certLooksLikeCardNumber(certDigits: string, card: ExtractedCard): boolean {
  const num = card.number?.replace(/\D/g, "") ?? "";
  if (!num || num.length < 2) return false;
  return (
    certDigits === num ||
    certDigits.endsWith(num) ||
    num.endsWith(certDigits) ||
    certDigits === (card.year?.replace(/\D/g, "") ?? "")
  );
}

function resolveGradedCert(
  card: ExtractedCard,
  grader: string | undefined,
  details: string | undefined,
): { cert: string | undefined; details: string | undefined } {
  const certField = cleanText(card.cert);
  if (isCertNotApplicable(certField)) {
    return {
      cert: CERT_NOT_VISIBLE,
      details: appendUniqueDetails(
        details,
        /cert on back|enter manually/i.test(details ?? "")
          ? undefined
          : "Cert on back — enter manually",
      ),
    };
  }

  const labeledDigits =
    extractExplicitCertDigits(certField, card.labelTitle, card.details, details) ??
    undefined;

  if (labeledDigits && !certLooksLikeCardNumber(labeledDigits, card)) {
    return { cert: labeledDigits, details };
  }

  const bareDigits = certField.replace(/\D/g, "");
  const bareLooksValid =
    bareDigits.length >= 6 &&
    bareDigits.length <= 12 &&
    !certLooksLikeCardNumber(bareDigits, card);

  if (bareLooksValid) {
    const graderUpper = cleanText(grader).toUpperCase();
    if (graderUpper === "PSA" || graderUpper === "SGC" || graderUpper === "ACE") {
      return { cert: bareDigits, details };
    }
    if (!graderRequiresExplicitCert(grader)) {
      return { cert: bareDigits, details };
    }
    if (/^#?\d{6,12}$/.test(certField.replace(/\s/g, ""))) {
      return { cert: bareDigits, details };
    }
  }

  const nextDetails = appendUniqueDetails(
    details,
    /cert on back|enter manually/i.test(details ?? "")
      ? undefined
      : "Cert on back — enter manually",
  );

  return { cert: CERT_NOT_VISIBLE, details: nextDetails };
}

/** Normalize grader / grade / cert from label text when vision splits fields unevenly. */
export function normalizeGradedSlabFields(
  card: ExtractedCard,
  laneHint?: "raw" | "graded",
): ExtractedCard {
  const lane = laneHint ?? classifyCardLane(card).lane;
  if (lane !== "graded") return card;

  const blobs = slabTextBlobs(card);
  const combinedBlob = blobs.join(" ");

  let grader = cleanText(card.grader);
  let grade = cleanText(card.grade);
  let details: string | undefined = cleanText(card.details) || undefined;
  const labelTitle = cleanText(card.labelTitle) || undefined;
  let name = cleanText(card.name);
  let set = cleanText(card.set);
  let number = cleanText(card.number);
  let year = cleanText(card.year);

  if (/^\d+(?:\.\d+)?\s+\d+(?:\.\d+)?$/.test(grade)) {
    const parts = grade.split(/\s+/);
    grade = parts[0] ?? grade;
  }

  const fromLabel = parseStructuredSlabLabel(labelTitle);
  if (!grader && fromLabel.grader) grader = fromLabel.grader;
  if (!grade && fromLabel.grade) grade = fromLabel.grade;
  if (!year && fromLabel.year) year = fromLabel.year;
  if (!set && fromLabel.set) set = fromLabel.set;
  if (!number && fromLabel.number) number = fromLabel.number;
  if (
    fromLabel.name &&
    (!name || /resolving|unknown|pending/i.test(name) || name.length < 3)
  ) {
    name = fromLabel.name;
  }

  for (const blob of blobs) {
    const combined = blob.match(
      new RegExp(
        `\\b(${GRADERS.join("|")})\\s*([0-9]{1,2}(?:\\.[0-9])?|GEM\\s*MINT|NM[-/]?MT|PRISTINE|BLACK\\s*LABEL)\\b`,
        "i",
      ),
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

  const gradeSplit = grade.match(
    new RegExp(`^(${GRADERS.join("|")})\\s+(.+)$`, "i"),
  );
  if (gradeSplit) {
    grader = grader || gradeSplit[1]!.toUpperCase();
    grade = gradeSplit[2]!.trim();
    if (!GRADE_NUM_PATTERN.test(grade)) {
      grade = extractGradeNumber(grade) ?? grade;
    }
  }

  const qualifiers = extractGradeQualifiers([grade, combinedBlob].join(" "));
  if (qualifiers.length > 0) {
    details = appendUniqueDetails(details, qualifiers.join(" · "));
  }

  if (grade && !GRADE_NUM_PATTERN.test(grade)) {
    const numeric = extractGradeNumber(grade);
    if (numeric) {
      details = appendUniqueDetails(details, grade);
      grade = numeric;
    }
  }

  const { cert, details: detailsWithCertNote } = resolveGradedCert(
    card,
    grader,
    details,
  );

  return {
    ...card,
    name: name || card.name,
    set: set || card.set,
    number: number || card.number,
    year: year || card.year,
    grader: grader || undefined,
    grade: grade || undefined,
    cert,
    labelTitle: labelTitle || undefined,
    details: detailsWithCertNote || undefined,
    encapsulation: card.encapsulation || "graded_slab",
    visionLane: card.visionLane ?? "graded",
  };
}

/** Fill missing slab fields from registry lookup without overwriting vision/user values. */
export function mergeRegistrySlabIntoCard(
  card: ExtractedCard,
  registry?: RegistrySnapshot | null,
): ExtractedCard {
  if (!registry) return normalizeGradedSlabFields(card);
  const next: ExtractedCard = { ...card };
  if (!cleanText(next.grader) && registry.grader) next.grader = registry.grader;
  if (!cleanText(next.grade) && registry.grade) next.grade = registry.grade;
  if (isCertNotApplicable(next.cert) && registry.certNumber) {
    const digits = registry.certNumber.replace(/\D/g, "");
    if (digits.length >= 6) next.cert = digits;
  }
  return normalizeGradedSlabFields(next, "graded");
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

  const normalized = normalizeGradedSlabFields(
    {
      name: card.name ?? "Card",
      grader: card.grader,
      grade: card.grade,
      cert: card.cert,
      labelTitle: card.labelTitle,
      details: card.details,
      rarity: card.rarity,
      encapsulation: card.encapsulation ?? "graded_slab",
    },
    "graded",
  );

  const grader = cleanText(normalized.grader);
  const grade = cleanText(normalized.grade);

  const parts: string[] = [];
  if (grader && grade) parts.push(`${grader} ${grade}`);
  else if (grader) parts.push(grader);
  else if (grade) parts.push(grade);

  if (hasReadableCertNumber(normalized.cert)) {
    parts.push(`#${normalized.cert!.replace(/\D/g, "")}`);
  } else if (isCertNotApplicable(normalized.cert)) {
    parts.push("Cert NA");
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}

/** Primary slab label line for evidence panels (holder text). */
export function formatSlabLabelLine(card: ExtractedCard): string | null {
  const title = cleanText(card.labelTitle);
  if (title) return title;
  const lane = classifyCardLane(card).lane;
  if (lane !== "graded") return null;
  const parts = [card.year, card.set, card.number, card.name].filter(Boolean);
  return parts.length >= 2 ? parts.join(" · ") : null;
}
