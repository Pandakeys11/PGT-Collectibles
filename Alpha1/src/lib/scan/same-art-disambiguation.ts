import { parseCollectorFraction } from "@/lib/scan/collector-fraction";
import {
  resolvePrintEdition,
  type PrintEditionId,
  type ResolvedPrintEdition,
} from "@/lib/scan/print-edition";
import {
  isEditionOnlySetName,
  setNamesMatch,
  uniqueCandidateForTotal,
  correctBaseSetVersusBaseSet2FractionOcr,
} from "@/lib/scan/set-identification";
import { isVintagePrintRunCard } from "@/lib/scan/vintage-print-run";
import type { ExtractedCard } from "@/lib/scan/schemas";

/** Compilation sets that reuse earlier artwork — disambiguate by /N, finish, symbol, year. */
export type ReprintSetProfile = {
  setName: string;
  setCode: string;
  printedTotal: number;
  year: string;
  defaultFinish?: PrintEditionId;
  /** When vision names an original set but the fraction is from this compilation. */
  misreadSourcePatterns: RegExp[];
};

export const REPRINT_COMPILATION_SETS: ReprintSetProfile[] = [
  {
    setName: "Legendary Collection",
    setCode: "base6",
    printedTotal: 110,
    year: "2002",
    defaultFinish: "reverse_holo",
    misreadSourcePatterns: [
      /^base\s*set(?!\s*2)/i,
      /^jungle$/i,
      /^fossil$/i,
      /^team\s*rocket$/i,
      /^gym/i,
      /^neo/i,
    ],
  },
  {
    setName: "Base Set 2",
    setCode: "base4",
    printedTotal: 130,
    year: "2000",
    misreadSourcePatterns: [/^base\s*set(?!\s*2)/i, /^jungle$/i, /^fossil$/i],
  },
  {
    setName: "Evolutions",
    setCode: "xy12",
    printedTotal: 112,
    year: "2016",
    misreadSourcePatterns: [
      /^base\s*set(?!\s*2)/i,
      /^jungle$/i,
      /^fossil$/i,
      /^team\s*rocket$/i,
      /^gym/i,
      /^neo/i,
    ],
  },
];

const REPRINT_BY_TOTAL = new Map(
  REPRINT_COMPILATION_SETS.map((profile) => [profile.printedTotal, profile]),
);
const REPRINT_BY_CODE = new Map(
  REPRINT_COMPILATION_SETS.map((profile) => [profile.setCode, profile]),
);

const VINTAGE_SET_PATTERN =
  /\b(base\s*set|jungle|fossil|team\s*rocket|gym\s*heroes|gym\s*challenge|neo\s*genesis|neo\s*discovery|neo\s*revelation|neo\s*destiny|legendary\s*collection|base\s*set\s*2|evolutions)\b/i;

function textBlob(
  card: Pick<
    ExtractedCard,
    "printStamps" | "details" | "rarity" | "set" | "labelTitle" | "year"
  >,
): string {
  return [card.printStamps, card.details, card.rarity, card.set, card.labelTitle, card.year]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function mergePrintStamps(existing: string | undefined, label: string): string {
  const e = existing?.trim();
  if (!e) return label;
  if (e.toLowerCase().includes(label.toLowerCase())) return e;
  return `${e} · ${label}`;
}

export function reprintProfileForDenominator(den: number): ReprintSetProfile | undefined {
  return REPRINT_BY_TOTAL.get(den);
}

export function reprintProfileForSetCode(code: string | null | undefined): ReprintSetProfile | undefined {
  const key = (code ?? "").trim().toLowerCase();
  return key ? REPRINT_BY_CODE.get(key) : undefined;
}

export function detectReverseHoloHints(
  card: Pick<ExtractedCard, "printStamps" | "details" | "rarity" | "set">,
): boolean {
  const h = textBlob(card);
  if (
    /\breverse\s*holo|\brev\s*holo|\breverse\s*foil|\bcosmos\s*holo|\bshiny\s*foil\s*border|\bfoil\s*pattern\s*on\s*(?:the\s*)?(?:image|art|border)/.test(
      h,
    )
  ) {
    return true;
  }
  if (/\blegendary\s*collection\b/.test(h) && /\b(holo|foil|reverse)\b/.test(h)) {
    return true;
  }
  return false;
}

export function detectHoloRareHints(
  card: Pick<ExtractedCard, "printStamps" | "details" | "rarity" | "set">,
): boolean {
  if (detectReverseHoloHints(card)) return false;
  const h = textBlob(card);
  return (
    /\bholo(\s*rare|\s*foil|\s*foil)?\b|\bholofoil\b|\b(rare|rare\s*holo)\b.*\bholo\b/.test(h) &&
    !/\bnon[\s-]*holo\b/.test(h)
  );
}

export function detectFirstEditionHints(
  card: Pick<ExtractedCard, "printStamps" | "details" | "set">,
): boolean {
  const h = textBlob(card);
  return /\b1st\s*ed(ition)?\b|\bfirst\s*edition\b/.test(h);
}

export function detectShadowlessHints(
  card: Pick<ExtractedCard, "printStamps" | "details" | "set">,
): boolean {
  return /\bshadowless\b/i.test(textBlob(card));
}

export function requestedCatalogVariantFromCard(
  card: Pick<ExtractedCard, "printStamps" | "details" | "rarity" | "set">,
): PrintEditionId | null {
  const edition = resolvePrintEdition(card);
  if (edition && edition.id !== "unknown") return edition.id;
  if (detectReverseHoloHints(card)) return "reverse_holo";
  if (detectFirstEditionHints(card)) return "first_edition";
  if (detectShadowlessHints(card)) return "shadowless";
  if (detectHoloRareHints(card)) return "holo";
  return null;
}

/** True when art-only matching is unsafe — need fraction, finish, or set symbol. */
export function needsVariantAwareCatalogSearch(
  card: Pick<ExtractedCard, "name" | "set" | "number" | "printStamps" | "details" | "rarity">,
): boolean {
  if (requestedCatalogVariantFromCard(card)) return true;
  if (isVintagePrintRunCard(card)) return true;
  const frac = parseCollectorFraction(card.number);
  if (frac && REPRINT_BY_TOTAL.has(frac.den)) return true;
  if (VINTAGE_SET_PATTERN.test(textBlob(card))) return true;
  if (frac && [64, 82, 132].includes(frac.den)) return true;
  return false;
}

function applyDenominatorSetOverride(card: ExtractedCard): ExtractedCard {
  const frac = parseCollectorFraction(card.number);
  if (!frac) return card;

  const unique = uniqueCandidateForTotal(frac.den);
  const reprint = reprintProfileForDenominator(frac.den);
  const setTrim = (card.set ?? "").trim();

  if (unique && !isEditionOnlySetName(setTrim) && setTrim && !setNamesMatch(setTrim, unique.name)) {
    const profile: ReprintSetProfile =
      reprint ??
      ({
        setName: unique.name,
        setCode: "",
        printedTotal: frac.den,
        year: unique.year ?? card.year ?? "",
        misreadSourcePatterns: [],
      } satisfies ReprintSetProfile);
    return applyReprintProfile(card, profile);
  }

  if (reprint && (!setTrim || reprint.misreadSourcePatterns.some((re) => re.test(setTrim)))) {
    return applyReprintProfile(card, reprint);
  }

  return card;
}

function applyReprintProfile(card: ExtractedCard, profile: ReprintSetProfile): ExtractedCard {
  const reverse = detectReverseHoloHints(card);
  const finish =
    profile.defaultFinish && (reverse || profile.defaultFinish === "reverse_holo")
      ? profile.defaultFinish
      : requestedCatalogVariantFromCard(card);

  let printStamps = card.printStamps;
  if (finish === "reverse_holo") printStamps = mergePrintStamps(printStamps, "Reverse Holo");
  else if (finish === "first_edition") printStamps = mergePrintStamps(printStamps, "1st Edition");
  else if (finish === "shadowless") printStamps = mergePrintStamps(printStamps, "Shadowless");
  else if (finish === "unlimited") printStamps = mergePrintStamps(printStamps, "Unlimited");

  return {
    ...card,
    set: profile.setName,
    year: card.year?.trim() || profile.year,
    printStamps,
  };
}

function applyVintageFinishPromotion(card: ExtractedCard): ExtractedCard {
  let next = card;
  if (detectReverseHoloHints(next) && resolvePrintEdition(next)?.id !== "reverse_holo") {
    next = { ...next, printStamps: mergePrintStamps(next.printStamps, "Reverse Holo") };
  }
  if (detectFirstEditionHints(next) && resolvePrintEdition(next)?.id !== "first_edition") {
    next = { ...next, printStamps: mergePrintStamps(next.printStamps, "1st Edition") };
  }
  if (detectShadowlessHints(next) && resolvePrintEdition(next)?.id !== "shadowless") {
    next = { ...next, printStamps: mergePrintStamps(next.printStamps, "Shadowless") };
  }
  return next;
}

function applyMisreadOriginalSetCorrection(card: ExtractedCard): ExtractedCard {
  const frac = parseCollectorFraction(card.number);
  const reverse = detectReverseHoloHints(card);
  const setTrim = (card.set ?? "").trim();
  if (!setTrim) return card;

  for (const profile of REPRINT_COMPILATION_SETS) {
    if (frac?.den === profile.printedTotal) continue;
    if (!profile.misreadSourcePatterns.some((re) => re.test(setTrim))) continue;

    if (profile.defaultFinish === "reverse_holo" && reverse) {
      return applyReprintProfile(card, profile);
    }
    if (profile.defaultFinish === "reverse_holo" && reverse && frac?.den === 102) {
      return {
        ...applyReprintProfile(card, profile),
        details: [card.details?.trim(), `Same art as ${setTrim} — likely ${profile.setName} /${profile.printedTotal}.`]
          .filter(Boolean)
          .join(" · "),
      };
    }
  }

  if (
    reverse &&
    /\bbase\s*set\b/i.test(setTrim) &&
    !/\bbase\s*set\s*2\b/i.test(setTrim) &&
    frac?.den === 102
  ) {
    return {
      ...card,
      details: [
        card.details?.trim(),
        "Reverse holo visible — confirm Base Set vs Legendary Collection (/110) or other reprint set.",
      ]
        .filter(Boolean)
        .join(" · "),
    };
  }

  return card;
}

/** Full pre-catalog identity hardening for same-art / finish collisions. */
export function applyCatalogIdentityHardening(card: ExtractedCard): ExtractedCard {
  const baseSetOcr = correctBaseSetVersusBaseSet2FractionOcr(card);
  let next = card;
  if (baseSetOcr.number || baseSetOcr.set || baseSetOcr.details || baseSetOcr.year) {
    next = {
      ...next,
      number: baseSetOcr.number ?? next.number,
      set: baseSetOcr.set ?? next.set,
      year: baseSetOcr.year ?? next.year,
      details: baseSetOcr.details ?? next.details,
    };
  }
  return applyMisreadOriginalSetCorrection(
    applyDenominatorSetOverride(applyVintageFinishPromotion(next)),
  );
}

export type SameArtScoreAdjustment = {
  scoreDelta: number;
  reasons: string[];
  conflicts: string[];
};

function normalizeName(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s*\((?:reverse\s*holo|1st\s*edition|shadowless|unlimited|holo)\)\s*$/i, "")
    .replace(/\s+/g, " ");
}

function collectorNumerator(value: string | null | undefined): string | null {
  const frac = parseCollectorFraction(value ?? undefined);
  if (frac) return frac.num.replace(/^0+/, "") || frac.num;
  const head = (value ?? "").trim().match(/^#?\s*(\d{1,4})/i)?.[1];
  return head ? head.replace(/^0+/, "") || head : null;
}

/** Score adjustments when catalog row may share artwork with other sets. */
export function scoreSameArtCatalogRow(
  card: ExtractedCard,
  hit: {
    setName: string | null;
    setCode?: string | null;
    setTotal?: number | null;
    variantKey: string | null;
  },
  printEdition: ResolvedPrintEdition | null,
): SameArtScoreAdjustment {
  const reasons: string[] = [];
  const conflicts: string[] = [];
  let scoreDelta = 0;

  const frac = parseCollectorFraction(card.number);
  const requestedSet = (card.set ?? "").trim().toLowerCase();
  const hitSet = (hit.setName ?? "").trim().toLowerCase();
  const reprint = reprintProfileForSetCode(hit.setCode ?? null);

  if (reprint && requestedSet.includes(reprint.setName.toLowerCase())) {
    scoreDelta += 16;
    reasons.push("set");
  }

  if (frac && hit.setTotal != null && hit.setTotal !== frac.den) {
    scoreDelta -= 30;
    conflicts.push("denominator");
  }

  if (printEdition && printEdition.id !== "unknown") {
    const variant = hit.variantKey;
    if (variant && variant === printEdition.id) {
      scoreDelta += 24;
      reasons.push("print_variant");
    } else if (variant && variant !== printEdition.id) {
      if (
        (printEdition.id === "reverse_holo" && variant !== "reverse_holo") ||
        (printEdition.id === "first_edition" &&
          (variant === "unlimited" || variant === "shadowless")) ||
        (printEdition.id === "unlimited" &&
          (variant === "first_edition" || variant === "shadowless"))
      ) {
        scoreDelta -= 35;
        conflicts.push("print_variant");
      } else {
        scoreDelta -= 10;
      }
    } else if (
      ["reverse_holo", "first_edition", "shadowless", "unlimited"].includes(printEdition.id)
    ) {
      scoreDelta -= 10;
      reasons.push("base_print_fallback");
    }
  }

  if (
    requestedSet.includes("legendary collection") &&
    hitSet.includes("base set") &&
    printEdition?.id === "reverse_holo"
  ) {
    scoreDelta -= 28;
    conflicts.push("set");
    conflicts.push("print_variant");
  }

  if (
    requestedSet.includes("base set") &&
    !requestedSet.includes("base set 2") &&
    reprint?.setCode === "base6" &&
    printEdition?.id === "reverse_holo"
  ) {
    scoreDelta -= 22;
    conflicts.push("set");
  }

  if (
    requestedSet.includes("evolutions") &&
    hitSet &&
    !hitSet.includes("evolutions") &&
    reprint?.setCode !== "xy12"
  ) {
    scoreDelta -= 20;
    conflicts.push("set");
  }

  if (
    requestedSet.includes("base set 2") &&
    hitSet.includes("base set") &&
    !hitSet.includes("base set 2")
  ) {
    scoreDelta -= 22;
    conflicts.push("set");
  }

  return { scoreDelta, reasons, conflicts };
}

export function detectSameArtCatalogCollision(
  top: {
    name: string;
    setName: string | null;
    cardNumber: string | null;
    score: number;
    reasons: string[];
    conflicts: string[];
  },
  runnerUp:
    | {
        name: string;
        setName: string | null;
        cardNumber: string | null;
        score: number;
        reasons: string[];
        conflicts: string[];
      }
    | undefined,
): boolean {
  if (!runnerUp) return false;
  if (top.conflicts.includes("print_variant") || top.conflicts.includes("denominator") || top.conflicts.includes("denominator conflict")) {
    return true;
  }
  const topName = normalizeName(top.name);
  const runName = normalizeName(runnerUp.name);
  if (!topName || topName !== runName) return false;

  const topNum = collectorNumerator(top.cardNumber);
  const runNum = collectorNumerator(runnerUp.cardNumber);
  if (topNum && runNum && topNum !== runNum) return false;

  const topSet = normalizeName(top.setName);
  const runSet = normalizeName(runnerUp.setName);
  if (!topSet || topSet === runSet) return false;

  const gap = top.score - runnerUp.score;
  const topStrong =
    top.reasons.includes("denominator") ||
    top.reasons.includes("print_variant") ||
    (top.reasons.includes("set") && !top.conflicts.includes("set"));

  if (topStrong && gap >= 14) return false;
  if (gap >= 20 && topStrong) return false;
  return true;
}

export function reprintSetCodesForSearch(
  card: Pick<ExtractedCard, "set" | "number" | "printStamps" | "details" | "rarity">,
): string[] {
  const codes = new Set<string>();
  const frac = parseCollectorFraction(card.number);
  if (frac) {
    const profile = reprintProfileForDenominator(frac.den);
    if (profile) codes.add(profile.setCode);
  }
  if (detectReverseHoloHints(card)) codes.add("base6");
  const setLower = (card.set ?? "").toLowerCase();
  if (setLower.includes("legendary collection")) codes.add("base6");
  if (setLower.includes("base set 2")) codes.add("base4");
  if (setLower.includes("evolutions")) codes.add("xy12");
  return [...codes];
}
