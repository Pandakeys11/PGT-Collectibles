import { getCatalogSetOverlay, hasCatalogSetOverlay } from "@/lib/pokedex/catalog-set-overlay";
import { parseCollectorFraction } from "@/lib/scan/collector-fraction";
import {
  resolvePrintEdition,
  type PrintEditionId,
  type ResolvedPrintEdition,
} from "@/lib/scan/print-edition";
import { setNamesMatch } from "@/lib/scan/set-identification";
import type { ExtractedCard } from "@/lib/scan/schemas";

/** English catalog set name → Pokémon TCG API set id (overlay spine). */
const SET_NAME_TO_CODE: Record<string, string> = {
  base: "base1",
  "base set": "base1",
  jungle: "base2",
  fossil: "base3",
  "base set 2": "base4",
  "team rocket": "base5",
  "gym heroes": "gym1",
  "gym challenge": "gym2",
  "neo genesis": "neo1",
  "neo discovery": "neo2",
  "neo revelation": "neo3",
  "neo destiny": "neo4",
};

const SHADOWLESS_ONLY_SET_CODES = new Set(["base1"]);

function textBlob(
  card: Pick<ExtractedCard, "printStamps" | "details" | "rarity" | "set">,
): string {
  return [card.printStamps, card.details, card.rarity, card.set].filter(Boolean).join(" ").toLowerCase();
}

export function resolveVintageSetCode(
  setName: string | null | undefined,
): string | null {
  const raw = (setName ?? "").trim().toLowerCase();
  if (!raw) return null;
  if (hasCatalogSetOverlay(raw)) return raw;
  const direct = SET_NAME_TO_CODE[raw];
  if (direct) return direct;
  for (const [name, code] of Object.entries(SET_NAME_TO_CODE)) {
    if (setNamesMatch(raw, name)) return code;
  }
  return null;
}

export function setSupportsShadowlessPrintRun(setCode: string | null | undefined): boolean {
  return Boolean(setCode && SHADOWLESS_ONLY_SET_CODES.has(setCode.trim()));
}

/** Overlay sets with Unlimited / 1st Edition / Shadowless materialized rows. */
export function setHasMaterializedPrintRuns(setCode: string | null | undefined): boolean {
  const code = setCode?.trim();
  if (!code) return false;
  const overlay = getCatalogSetOverlay(code);
  if (!overlay?.printingVariants?.length) return false;
  return overlay.printingVariants.some(
    (v) => v.id !== "catalog" && ["unlimited", "first_edition", "shadowless"].includes(v.id),
  );
}

export function isVintagePrintRunCard(
  card: Pick<ExtractedCard, "set" | "number" | "printStamps" | "details">,
): boolean {
  const code = resolveVintageSetCode(card.set);
  if (!code || !setHasMaterializedPrintRuns(code)) return false;
  const frac = parseCollectorFraction(card.number);
  if (!frac) return false;
  return frac.den >= 62 && frac.den <= 132;
}

/** Vision writes art-box shadow cues into details — parse for Base Set disambiguation. */
export function detectArtBoxShadowCue(
  card: Pick<ExtractedCard, "printStamps" | "details">,
): "shadowless" | "shadowed" | null {
  const h = textBlob(card);
  if (
    /\b(no|without|missing|flat)\s+(drop\s*)?shadow|\bshadowless\s+(art|frame|box)\b|\bflat\s+art\s+box\b|\bno\s+art\s+box\s+shadow\b/.test(
      h,
    )
  ) {
    return "shadowless";
  }
  if (
    /\bdrop\s*shadow|\bshadowed\s+(art|frame|box)\b|\bart\s+box\s+shadow\b|\bdistinct\s+(dark\s+)?shadow\b/.test(
      h,
    )
  ) {
    return "shadowed";
  }
  if (/\bcopyright.*\b99\b|\b©.*99\b|\b1999\b.*shadowless\b/.test(h)) {
    return "shadowless";
  }
  return null;
}

function mergePrintStamps(existing: string | undefined, label: string): string {
  const e = existing?.trim();
  if (!e) return label;
  if (e.toLowerCase().includes(label.toLowerCase())) return e;
  return `${e} · ${label}`;
}

/**
 * Infer print run when stamps are missing but visual cues exist (Base Set raw scans).
 * Priority: 1st Edition stamp > explicit Shadowless > art-box shadowless > Unlimited (shadowed).
 */
export function inferVintagePrintEdition(
  card: Pick<ExtractedCard, "printStamps" | "details" | "rarity" | "set">,
): PrintEditionId | null {
  const resolved = resolvePrintEdition(card);
  if (resolved && resolved.id !== "unknown") return resolved.id;

  const setCode = resolveVintageSetCode(card.set);
  if (!setCode || !setHasMaterializedPrintRuns(setCode)) return null;

  const h = textBlob(card);
  if (/\b1st\s*ed(ition)?\b|\bfirst\s*edition\b|\bedition\s*1\b/.test(h)) {
    return "first_edition";
  }

  const shadowCue = detectArtBoxShadowCue(card);
  if (setSupportsShadowlessPrintRun(setCode)) {
    if (/\bshadowless\b/.test(h) || shadowCue === "shadowless") return "shadowless";
    if (shadowCue === "shadowed") return "unlimited";
  }

  if (/\bunlimited\b/.test(h)) return "unlimited";
  return null;
}

export function applyVintagePrintRunHardening(card: ExtractedCard): ExtractedCard {
  if (!isVintagePrintRunCard(card)) return card;

  let next = card;
  const inferred = inferVintagePrintEdition(next);
  if (!inferred) return next;

  const label =
    inferred === "first_edition"
      ? "1st Edition"
      : inferred === "shadowless"
        ? "Shadowless"
        : inferred === "unlimited"
          ? "Unlimited"
          : null;
  if (!label) return next;

  next = {
    ...next,
    printStamps: mergePrintStamps(next.printStamps, label),
  };

  const setCode = resolveVintageSetCode(next.set);
  if (setSupportsShadowlessPrintRun(setCode ?? "") && inferred === "shadowless") {
    const cue = detectArtBoxShadowCue(next);
    if (!cue) {
      next = {
        ...next,
        details: [next.details?.trim(), "Shadowless — no drop shadow on art frame."]
          .filter(Boolean)
          .join(" · "),
      };
    }
  }
  if (setSupportsShadowlessPrintRun(setCode ?? "") && inferred === "unlimited") {
    const cue = detectArtBoxShadowCue(next);
    if (!cue) {
      next = {
        ...next,
        details: [next.details?.trim(), "Unlimited — drop shadow visible on art frame."]
          .filter(Boolean)
          .join(" · "),
      };
    }
  }

  return next;
}

export function catalogIdPrintVariantKey(catalogId: string): string | null {
  const m = catalogId.match(/__(first_edition|shadowless|unlimited|reverse_holo)$/);
  return m?.[1] ?? null;
}

export type VintagePrintScoreAdjustment = {
  scoreDelta: number;
  reasons: string[];
  conflicts: string[];
};

/** Score adjustments for WOTC 1st / Shadowless / Unlimited synthetic rows. */
export function scoreVintagePrintCatalogRow(
  card: ExtractedCard,
  hit: { catalogId: string; variantKey: string | null },
  printEdition: ResolvedPrintEdition | null,
): VintagePrintScoreAdjustment {
  const reasons: string[] = [];
  const conflicts: string[] = [];
  let scoreDelta = 0;

  if (!isVintagePrintRunCard(card)) {
    return { scoreDelta, reasons, conflicts };
  }

  const requested = inferVintagePrintEdition(card) ?? resolvePrintEdition(card)?.id ?? null;
  const hitVariant = hit.variantKey ?? catalogIdPrintVariantKey(hit.catalogId);

  if (!requested || requested === "unknown") {
    if (hitVariant) {
      scoreDelta -= 12;
      reasons.push("base_print_fallback");
    }
    return { scoreDelta, reasons, conflicts };
  }

  if (hitVariant && hitVariant === requested) {
    scoreDelta += 28;
    reasons.push("print_variant");
  } else if (hitVariant && hitVariant !== requested) {
    scoreDelta -= 40;
    conflicts.push("print_variant");
  } else if (!hitVariant && ["first_edition", "shadowless", "unlimited"].includes(requested)) {
    scoreDelta -= 18;
    conflicts.push("print_variant");
  }

  return { scoreDelta, reasons, conflicts };
}

export function detectVintagePrintCatalogCollision(
  card: ExtractedCard,
  top: { catalogId: string; score: number; reasons: string[]; conflicts: string[] },
  runnerUp:
    | { catalogId: string; score: number; reasons: string[]; conflicts: string[] }
    | undefined,
): boolean {
  if (!isVintagePrintRunCard(card)) return false;
  if (top.conflicts.includes("print_variant")) return true;

  const requested = inferVintagePrintEdition(card) ?? resolvePrintEdition(card)?.id;
  if (!requested || requested === "unknown") {
    const topIsBase = !catalogIdPrintVariantKey(top.catalogId);
    if (topIsBase && setHasMaterializedPrintRuns(resolveVintageSetCode(card.set))) {
      return true;
    }
    return false;
  }

  const topVariant = catalogIdPrintVariantKey(top.catalogId);
  if (topVariant && topVariant !== requested) return true;

  if (!runnerUp) return false;
  const runVariant = catalogIdPrintVariantKey(runnerUp.catalogId);
  if (!topVariant || !runVariant || topVariant === runVariant) return false;

  const gap = top.score - runnerUp.score;
  if (top.reasons.includes("print_variant") && gap >= 14) return false;
  return gap < 16;
}

export function vintagePrintRunSetCodesForSearch(
  card: Pick<ExtractedCard, "set" | "number" | "printStamps" | "details">,
): string[] {
  const code = resolveVintageSetCode(card.set);
  if (!code || !setHasMaterializedPrintRuns(code)) return [];
  if (!inferVintagePrintEdition(card) && !resolvePrintEdition(card)) return [];
  return [code];
}
