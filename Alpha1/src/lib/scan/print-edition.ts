import type { ExtractedCard, MarketEvidence } from "@/lib/scan/schemas";

/** Canonical print run for vintage Pokémon and similar TCG stamps. */
export type PrintEditionId =
  | "first_edition"
  | "shadowless"
  | "unlimited"
  | "reverse_holo"
  | "holo"
  | "promo"
  | "unknown";

export type ResolvedPrintEdition = {
  id: PrintEditionId;
  label: string;
  /** Human-readable source of the classification. */
  source: "printStamps" | "details" | "inferred";
};

const EDITION_LABELS: Record<PrintEditionId, string> = {
  first_edition: "1st Edition",
  shadowless: "Shadowless",
  unlimited: "Unlimited",
  reverse_holo: "Reverse Holo",
  holo: "Holo",
  promo: "Promo",
  unknown: "Print run unclear",
};

function haystack(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ");
}

/** Normalize vision/user text into a canonical print edition when possible. */
export function resolvePrintEdition(card: Pick<ExtractedCard, "printStamps" | "details">): ResolvedPrintEdition | null {
  const parts = [card.printStamps, card.details].filter(Boolean).join(" ");
  const h = haystack(parts);
  if (!h.trim()) return null;

  if (/\b1st\s*ed(ition)?\b|\bfirst\s*edition\b|\bedition\s*1\b/.test(h)) {
    return { id: "first_edition", label: EDITION_LABELS.first_edition, source: card.printStamps ? "printStamps" : "details" };
  }
  if (/\bshadowless\b/.test(h)) {
    return { id: "shadowless", label: EDITION_LABELS.shadowless, source: card.printStamps ? "printStamps" : "details" };
  }
  if (/\bunlimited\b|\bunl\.?\s*ed/.test(h)) {
    return { id: "unlimited", label: EDITION_LABELS.unlimited, source: card.printStamps ? "printStamps" : "details" };
  }
  if (/\breverse\s*holo|\brev\s*holo\b/.test(h)) {
    return { id: "reverse_holo", label: EDITION_LABELS.reverse_holo, source: card.printStamps ? "printStamps" : "details" };
  }
  if (/\bholofoil\b|\bholo\b(?!\s*reverse)/.test(h) && !/\bnon\s*holo\b/.test(h)) {
    return { id: "holo", label: EDITION_LABELS.holo, source: card.printStamps ? "printStamps" : "details" };
  }
  if (/\bpromo\b|\bpromotional\b/.test(h)) {
    return { id: "promo", label: EDITION_LABELS.promo, source: card.printStamps ? "printStamps" : "details" };
  }

  return { id: "unknown", label: EDITION_LABELS.unknown, source: "inferred" };
}

export function canonicalPrintEditionLabel(id: PrintEditionId): string {
  return EDITION_LABELS[id];
}

/** Merge resolved edition back onto card fields for downstream search. */
export function applyResolvedPrintEdition(card: ExtractedCard): ExtractedCard {
  const resolved = resolvePrintEdition(card);
  if (!resolved || resolved.id === "unknown") return card;
  const stamps = card.printStamps?.trim();
  if (stamps && haystack(stamps).includes(haystack(resolved.label))) return card;
  return {
    ...card,
    printStamps: stamps ? `${stamps} · ${resolved.label}` : resolved.label,
  };
}

function evidenceHay(item: MarketEvidence): string {
  return haystack(`${item.title} ${item.slab ?? ""} ${item.source ?? ""}`);
}

function editionConflict(h: string, edition: PrintEditionId): boolean {
  switch (edition) {
    case "first_edition":
      return (
        (/\bunlimited\b/.test(h) && !/1st\s*ed|first\s*edition/.test(h)) ||
        (/shadowless/.test(h) && !/1st\s*ed|first\s*edition/.test(h))
      );
    case "shadowless":
      return /1st\s*ed|first\s*edition/.test(h) || (/\bunlimited\b/.test(h) && !/shadowless/.test(h));
    case "unlimited":
      return /1st\s*ed|first\s*edition|shadowless/.test(h);
    case "reverse_holo":
      return /\bnon\s*reverse\b|\bregular\b(?!\s*reverse)/.test(h) && !/reverse\s*holo|rev\s*holo/.test(h);
    default:
      return false;
  }
}

function editionAffirms(h: string, edition: PrintEditionId): boolean {
  switch (edition) {
    case "first_edition":
      return /1st\s*ed|first\s*edition/.test(h);
    case "shadowless":
      return /shadowless/.test(h);
    case "unlimited":
      return /\bunlimited\b/.test(h);
    case "reverse_holo":
      return /reverse\s*holo|rev\s*holo/.test(h);
    case "holo":
      return /\bholo\b|\bholofoil\b/.test(h) && !/reverse\s*holo/.test(h);
    case "promo":
      return /\bpromo\b/.test(h);
    default:
      return false;
  }
}

/**
 * Keep comps that match the extracted print run. Prefer explicit edition matches;
 * fall back to non-conflicting rows when too few sold points exist.
 */
export function filterEvidenceByPrintEdition(
  items: MarketEvidence[],
  card: Pick<ExtractedCard, "printStamps" | "details">,
): MarketEvidence[] {
  const edition = resolvePrintEdition(card);
  if (!edition || edition.id === "unknown") return items;

  const nonConflict = items.filter((item) => !editionConflict(evidenceHay(item), edition.id));
  const affirmed = nonConflict.filter((item) => editionAffirms(evidenceHay(item), edition.id));

  const soldAffirmed = affirmed.filter((i) => i.kind === "sold");
  const soldNeutral = nonConflict.filter((i) => i.kind === "sold");

  if (soldAffirmed.length >= 2) {
    const rest = nonConflict.filter((i) => !affirmed.includes(i));
    return [...affirmed, ...rest];
  }
  if (soldNeutral.length >= 2) return nonConflict;
  if (affirmed.length >= 1) return nonConflict;
  return items;
}

/** Pick TCGPlayer API variant row that best matches the resolved print edition. */
export function tcgPlayerVariantKeyForEdition(
  variantKeys: string[],
  card: Pick<ExtractedCard, "printStamps" | "details">,
): string | null {
  const edition = resolvePrintEdition(card);
  if (!edition || variantKeys.length === 0) return variantKeys[0] ?? null;

  const normalized = variantKeys.map((k) => ({ k, h: haystack(k) }));

  if (edition.id === "first_edition") {
    const hit = normalized.find((v) => /1st|firstedition|first_ed/.test(v.h));
    if (hit) return hit.k;
  }
  if (edition.id === "shadowless") {
    const hit = normalized.find((v) => /shadowless/.test(v.h));
    if (hit) return hit.k;
  }
  if (edition.id === "unlimited") {
    const hit = normalized.find(
      (v) => /unlimited|normal|nonholo|holo(?!foil)/.test(v.h) && !/1st|first|shadowless/.test(v.h),
    );
    if (hit) return hit.k;
  }
  if (edition.id === "reverse_holo") {
    const hit = normalized.find((v) => /reverse/.test(v.h));
    if (hit) return hit.k;
  }

  return variantKeys[0] ?? null;
}

export function printEditionBlocker(card: ExtractedCard, lane: "raw" | "graded"): string | null {
  if (lane === "graded") return null;
  const edition = resolvePrintEdition(card);
  const set = card.set?.trim() ?? "";
  const isVintagePokemon =
    /base set|jungle|fossil|team rocket|gym|neo genesis|neo discovery/i.test(set) ||
    /\/(102|64|62|82|111)\b/.test(card.number ?? "");
  if (!isVintagePokemon) return null;
  if (!edition || edition.id === "unknown") {
    return "Vintage raw card — confirm 1st Edition, Shadowless, or Unlimited on the stamp before trusting FMV.";
  }
  return null;
}
