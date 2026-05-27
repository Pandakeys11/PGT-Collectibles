import { normalizeGradedSlabFields } from "@/lib/scan/graded-slab";
import {
  canonicalPromoSetName,
  normalizePromoCardIdentity,
} from "@/lib/scan/promo-set-aliases";
import { classifyCardLane } from "@/lib/scan/lane";
import { applyResolvedPrintEdition } from "@/lib/scan/print-edition";
import { isDexLikeCardNumberOnly } from "@/lib/scan/collector-fraction";
import { inferCardFranchise } from "@/lib/scan/franchise";
import { applySetFromCollectorFraction, applyWizardsTitleAndFractionHeuristics } from "@/lib/scan/set-identification";
import { normalizeVisionBboxGrid, scaleVisionGridCoord } from "@/lib/scan/spatial-grid";
import { isNonTcgPokemonCollectible } from "@/lib/scan/non-tcg-pokemon";
import { extractedCardSchema, type ExtractedCard } from "@/lib/scan/schemas";

function asString(value: unknown): string | undefined {
  if (value == null) return undefined;
  const text = String(value).trim();
  return text.length > 0 ? text : undefined;
}

function asNumber(value: unknown): number | null | undefined {
  if (value == null || value === "") return undefined;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const digits = String(value).replace(/[^0-9.]/g, "");
  if (!digits) return undefined;
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function asLocation(value: unknown): [number, number] | undefined {
  if (!Array.isArray(value) || value.length < 2) return undefined;
  const y = Number(value[0]);
  const x = Number(value[1]);
  if (!Number.isFinite(y) || !Number.isFinite(x)) return undefined;
  return [scaleVisionGridCoord(y), scaleVisionGridCoord(x)];
}

function asBbox(
  value: unknown,
): { top: number; left: number; width: number; height: number } | undefined {
  return normalizeVisionBboxGrid(value);
}

function locationFromBbox(
  bbox: { top: number; left: number; width: number; height: number } | undefined,
): [number, number] | undefined {
  if (!bbox) return undefined;
  const y = Math.max(0, Math.min(1000, Math.round(bbox.top + bbox.height / 2)));
  const x = Math.max(0, Math.min(1000, Math.round(bbox.left + bbox.width / 2)));
  return [y, x];
}

function fallbackName(raw: Record<string, unknown>): string {
  return (
    asString(raw.name) ??
    asString(raw.labelTitle) ??
    asString(raw.details) ??
    asString(raw.set) ??
    "Unknown card"
  );
}

/** Move mistaken "set" values that are editions into details; split "1st Edition Jungle" style strings. */
function moveEditionFromSetToDetails(
  set: string | undefined,
  details: string | undefined,
): { set?: string; details?: string } {
  const s = set?.trim();
  const d = details?.trim();
  if (!s) return { set: undefined, details: d };

  if (/^(1st\s*edition|first\s*edition|shadowless|unlimited)$/i.test(s)) {
    const merged = [s, d].filter(Boolean).join(" · ");
    return { set: undefined, details: merged || undefined };
  }

  const editionPrefix = s.match(/^(1st\s*edition|first\s*edition)\s+(.+)$/i);
  if (editionPrefix?.[2]?.trim()) {
    const rest = editionPrefix[2].trim();
    const mergedDetails = [editionPrefix[1].trim(), d].filter(Boolean).join(" · ");
    return { set: rest, details: mergedDetails || undefined };
  }

  return { set: s, details: d };
}

/** Move edition-only or non-numeric "number" into details so search/catalog stay accurate */
function sanitizeNumberAndDetails(
  number: string | undefined,
  details: string | undefined,
): { number?: string; details?: string } {
  if (!number?.trim()) return { number, details };

  const trimmed = number.trim();
  const editionOnly =
    /^(1st\s*edition|first\s*edition|shadowless|unlimited|unl\.?|holo|reverse|promo)$/i.test(trimmed) ||
    (!/\d/.test(trimmed) && trimmed.length > 0);

  if (editionOnly) {
    const merged = [trimmed, details?.trim()].filter(Boolean).join(" · ");
    return { number: undefined, details: merged || undefined };
  }

  return { number: trimmed, details };
}

/** Bare digits (often Pokédex #) are not collector numbers — strip so catalog + re-scan can recover. */
function stripDexLikeCollectorNumber(
  number: string | undefined,
  details: string | undefined,
): { number?: string; details?: string } {
  if (!isDexLikeCardNumberOnly(number)) return { number, details };
  const raw = (number ?? "").trim();
  const note = `Collector # unclear (possible Pokédex misread: ${raw})`;
  const merged = [note, details?.trim()].filter(Boolean).join(" · ");
  return { number: undefined, details: merged || undefined };
}

function promoteFirstEditionFromDetails(
  printStamps: string | undefined,
  details: string | undefined,
): { printStamps?: string; details?: string } {
  const ps = printStamps?.trim();
  if (ps) return {};
  const d = details?.trim();
  if (!d || !/1st\s*edition|first\s*edition|edition\s*1\b/i.test(d)) return {};
  return { printStamps: "1st Edition", details: d };
}

export function normalizeVisionCard(raw: unknown): ExtractedCard | null {
  if (!raw || typeof raw !== "object") return null;
  const record = { ...(raw as Record<string, unknown>) };
  const lane = classifyCardLane(record);

  const rawNumber = asString(record.number);
  const rawDetails = asString(record.details);
  const laneEarly = classifyCardLane(record);
  const { number: numAfterDex, details: detailsAfterDex } =
    laneEarly.lane === "graded"
      ? { number: rawNumber, details: rawDetails }
      : stripDexLikeCollectorNumber(rawNumber, rawDetails);
  const { number, details: numDetails } = sanitizeNumberAndDetails(numAfterDex, detailsAfterDex);
  const rawSet = asString(record.set);
  const { set: setAfterEdition, details: detailsAfterEdition } = moveEditionFromSetToDetails(rawSet, numDetails);
  const nameEarly = fallbackName(record);
  const franchiseHint = inferCardFranchise({
    franchise: asString(record.franchise) ?? asString(record.game) ?? asString(record.category),
    name: nameEarly,
    printedName: asString(record.printedName),
    set: setAfterEdition,
    number,
    details: detailsAfterEdition,
    printStamps: asString(record.printStamps),
    rarity: asString(record.rarity),
    labelTitle: asString(record.labelTitle),
  } as ExtractedCard);
  const wiz = franchiseHint.isPokemon
    ? applyWizardsTitleAndFractionHeuristics(nameEarly, setAfterEdition, number, detailsAfterEdition)
    : {
        number,
        set: setAfterEdition,
        details: detailsAfterEdition,
        clearSet: false,
      };
  const numAfterWiz = wiz.number ?? number;
  const setAfterWiz = wiz.clearSet ? undefined : (wiz.set !== undefined ? wiz.set : setAfterEdition);
  const detAfterWiz = wiz.details ?? detailsAfterEdition;
  const setFromFraction = applySetFromCollectorFraction(setAfterWiz, numAfterWiz, detAfterWiz);
  const setBeforePromo =
    setFromFraction.set !== undefined ? setFromFraction.set : setAfterWiz;
  const promoNorm = franchiseHint.isPokemon
    ? normalizePromoCardIdentity({ set: setBeforePromo, number: numAfterWiz })
    : { set: setBeforePromo, number: numAfterWiz };
  const finalSet = canonicalPromoSetName(promoNorm.set) ?? promoNorm.set;
  const finalNumber = promoNorm.number ?? numAfterWiz;
  const yearFromVision = asString(record.year);
  const year = setFromFraction.year ?? yearFromVision;
  const bbox = asBbox(record.bbox);

  const printFromDetails = promoteFirstEditionFromDetails(
    asString(record.printStamps),
    setFromFraction.details ?? detAfterWiz,
  );
  const mergedPrint = printFromDetails.printStamps ?? asString(record.printStamps);
  const mergedDetails = printFromDetails.details ?? detAfterWiz;

  const normalized = {
    franchise: asString(record.franchise) ?? asString(record.game) ?? asString(record.category),
    name: nameEarly,
    printedName: asString(record.printedName),
    language: asString(record.language),
    set: finalSet,
    number: finalNumber,
    year,
    rarity: asString(record.rarity),
    grader: asString(record.grader),
    grade: asString(record.grade),
    cert: asString(record.cert),
    details: mergedDetails,
    labelTitle: asString(record.labelTitle),
    extractedPrice: asNumber(record.extractedPrice) ?? null,
    stickerNote: asString(record.stickerNote) ?? null,
    printStamps: mergedPrint,
    encapsulation: asString(record.encapsulation),
    location: asLocation(record.location) ?? locationFromBbox(bbox),
    bbox,
    sourceImageIndex:
      typeof record.sourceImageIndex === "number"
        ? record.sourceImageIndex
        : record.sourceImageIndex === null
          ? null
          : undefined,
    visionBatchMerged:
      typeof record.visionBatchMerged === "boolean" ? record.visionBatchMerged : undefined,
    visionLane: lane.lane,
    visionLaneConfidence: lane.confidence,
  };

  const parsed = extractedCardSchema.safeParse(normalized);
  if (!parsed.success) return null;
  const graded = normalizeGradedSlabFields(parsed.data, lane.lane);
  const profile = inferCardFranchise(graded);
  const withFranchise = {
    ...graded,
    franchise: isNonTcgPokemonCollectible(graded) ? "other" : (graded.franchise ?? profile.id),
  };
  return applyResolvedPrintEdition(withFranchise);
}
