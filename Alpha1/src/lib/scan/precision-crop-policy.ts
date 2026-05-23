import { hasReadableCertNumber } from "@/lib/scan/graded-slab";
import { extractedCardSchema, type ExtractedCard } from "@/lib/scan/schemas";

export type PrecisionCropSpecimen = {
  id: string;
  previewUrl?: string | null;
  card: ExtractedCard;
  context: { lane: "raw" | "graded" };
};

const UNKNOWN_NAME = /^unknown|resolving identity$/i;
const WEAK_SET = /^unknown|pending$/i;

export function isPrecisionCropEnabled(): boolean {
  const raw =
    (typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_SCAN_PRECISION_CROP?.trim() ||
        process.env.SCAN_PRECISION_CROP?.trim()
      : undefined) ?? "1";
  return raw !== "0" && raw.toLowerCase() !== "false";
}

export function maxPrecisionCropPerScan(): number {
  const raw =
    (typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_SCAN_PRECISION_CROP_MAX?.trim() ||
        process.env.SCAN_PRECISION_CROP_MAX?.trim()
      : undefined) ?? "4";
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 4;
  return Math.min(Math.floor(n), 12);
}

function hasStrongName(card: ExtractedCard): boolean {
  const name = card.name?.trim() ?? "";
  return Boolean(name) && !UNKNOWN_NAME.test(name);
}

function hasStrongSet(card: ExtractedCard): boolean {
  const set = card.set?.trim() ?? "";
  return Boolean(set) && !WEAK_SET.test(set);
}

function hasCollectorNumber(card: ExtractedCard): boolean {
  return Boolean(card.number?.trim());
}

/** Core identity present on the first full-page vision pass — skip a second vision call. */
export function hasCoreCatalogIdentity(card: ExtractedCard): boolean {
  return hasStrongName(card) && hasStrongSet(card) && hasCollectorNumber(card);
}

export function identityCompleteness(card: ExtractedCard): number {
  let score = 0;
  if (hasStrongName(card)) score += 2;
  if (hasStrongSet(card)) score += 2;
  if (hasCollectorNumber(card)) score += 3;
  if (card.year?.trim()) score += 1;
  if (card.rarity?.trim()) score += 1;
  if (card.printStamps?.trim()) score += 1;
  return score;
}

/** Only re-crop when name, set, or collector number is actually missing — not for missing rarity/year alone. */
export function needsPrecisionCrop(item: PrecisionCropSpecimen): boolean {
  if (!item.previewUrl) return false;
  const c = item.card;

  if (hasCoreCatalogIdentity(c)) return false;

  if (item.context.lane === "graded") {
    const grader = c.grader?.trim();
    const grade = c.grade?.trim();
    if (
      hasStrongName(c) &&
      hasStrongSet(c) &&
      hasReadableCertNumber(c.cert) &&
      hasCollectorNumber(c)
    ) {
      return false;
    }
    if (hasStrongName(c) && grader && grade && hasReadableCertNumber(c.cert)) {
      return false;
    }
  }

  if (!hasStrongName(c)) return true;
  if (!hasCollectorNumber(c)) return true;
  if (!hasStrongSet(c)) return true;

  return false;
}

export type PrecisionCropLimits = {
  enabled?: boolean;
  max?: number;
};

/** Weakest rows first; hard cap keeps binder scans fast (default 4). */
export function selectPrecisionCropCandidates<T extends PrecisionCropSpecimen>(
  specimens: T[],
  limits?: PrecisionCropLimits,
): T[] {
  const enabled = limits?.enabled ?? isPrecisionCropEnabled();
  if (!enabled) return [];
  const cap = limits?.max ?? maxPrecisionCropPerScan();
  if (cap === 0) return [];

  return specimens
    .filter(needsPrecisionCrop)
    .sort(
      (a, b) =>
        identityCompleteness(a.card) - identityCompleteness(b.card) ||
        a.id.localeCompare(b.id),
    )
    .slice(0, cap);
}

/**
 * Fill gaps from the tight crop without overwriting strong full-page fields
 * (avoids crop hallucinations replacing a good binder read).
 */
export function mergePrecisionCard(
  base: ExtractedCard,
  crop: ExtractedCard,
): ExtractedCard {
  const merged: ExtractedCard = { ...base };
  const identityKeys: Array<keyof ExtractedCard> = [
    "name",
    "printedName",
    "language",
    "set",
    "number",
    "year",
    "rarity",
    "printStamps",
    "grader",
    "grade",
    "cert",
    "labelTitle",
    "encapsulation",
  ];

  for (const key of identityKeys) {
    const cropVal = crop[key];
    const baseVal = merged[key];
    if (typeof cropVal !== "string" || !cropVal.trim()) continue;
    if (typeof baseVal === "string" && baseVal.trim()) continue;
    (merged as Record<string, unknown>)[key] = cropVal.trim();
  }

  if (!merged.details?.trim() && crop.details?.trim()) {
    merged.details = crop.details.trim();
  } else if (base.details?.trim() && crop.details?.trim() && base.details !== crop.details) {
    merged.details = [base.details.trim(), crop.details.trim()].join(" · ");
  }

  if (merged.extractedPrice == null && typeof crop.extractedPrice === "number") {
    merged.extractedPrice = crop.extractedPrice;
  }
  if (!merged.stickerNote?.trim() && crop.stickerNote?.trim()) {
    merged.stickerNote = crop.stickerNote;
  }
  if (!merged.bbox && crop.bbox) merged.bbox = crop.bbox;

  return extractedCardSchema.parse(merged);
}

export function precisionCropImproves(
  before: ExtractedCard,
  after: ExtractedCard,
): boolean {
  if (identityCompleteness(after) > identityCompleteness(before)) return true;
  if (hasCoreCatalogIdentity(after) && !hasCoreCatalogIdentity(before)) return true;
  return false;
}
