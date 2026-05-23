import type { ScanSpecimen } from "@/hooks/use-scan-session";
import type { ExtractedCard } from "@/lib/scan/schemas";
import { resolvePrintEdition } from "@/lib/scan/print-edition";

/** Sports / TCG parallel and finish cues (non-Pokémon canonical ids). */
const PARALLEL_PATTERNS: ReadonlyArray<[RegExp, string]> = [
  [/\bsilver\s*prizm\b/i, "Silver Prizm"],
  [/\bgold\s*prizm\b/i, "Gold Prizm"],
  [/\bblack\s*prizm\b/i, "Black Prizm"],
  [/\bmojo\s*prizm\b/i, "Mojo Prizm"],
  [/\bprizm\b/i, "Prizm"],
  [/\brefractor\b/i, "Refractor"],
  [/\bx\s*fractor\b/i, "X-Fractor"],
  [/\boptic\b/i, "Optic"],
  [/\bselect\b/i, "Select"],
  [/\bmosaic\b/i, "Mosaic"],
  [/\bdonruss\b/i, "Donruss"],
  [/\bchrome\b/i, "Chrome"],
  [/\bbowman\s*chrome\b/i, "Bowman Chrome"],
  [/\bwave\b/i, "Wave"],
  [/\bspeckle\b/i, "Speckle"],
  [/\bdisco\b/i, "Disco"],
  [/\bshimmer\b/i, "Shimmer"],
  [/\bsparkle\b/i, "Sparkle"],
  [/\bfoil\b/i, "Foil"],
  [/\bnon[\s-]*foil\b/i, "Non-Foil"],
  [/\balt\s*art\b/i, "Alt Art"],
  [/\bfull\s*art\b/i, "Full Art"],
  [/\billustration\s*rare\b/i, "Illustration Rare"],
  [/\bspecial\s*illustration\s*rare\b/i, "Special Illustration Rare"],
  [/\bsecret\s*rare\b/i, "Secret Rare"],
  [/\bmaster\s*ball\b/i, "Master Ball"],
  [/\bpoke\s*ball\b/i, "Poké Ball"],
  [/\benglish\b/i, "English"],
  [/\bjapanese\b/i, "Japanese"],
  [/\bkorean\b/i, "Korean"],
  [/\bchinese\b/i, "Chinese"],
];

function haystack(parts: string[]): string {
  return parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function matchParallelLabel(text: string): string | null {
  const h = haystack([text]);
  if (!h.trim()) return null;
  for (const [re, label] of PARALLEL_PATTERNS) {
    if (re.test(h)) return label;
  }
  return null;
}

/** Canonical version/edition label for UI and spreadsheet (matches scan sheet). */
export function displayPrintVersion(
  card: Pick<ExtractedCard, "printStamps" | "details">,
  variantLabel?: string | null,
): string {
  const edition = resolvePrintEdition(card);
  if (edition && edition.id !== "unknown" && edition.id !== "promo") {
    return edition.label;
  }
  const stamps = card.printStamps?.trim();
  if (stamps) {
    const parallel = matchParallelLabel(stamps);
    if (parallel) return parallel;
    return stamps;
  }
  const fromDetails = card.details?.trim();
  if (fromDetails) {
    const parallel = matchParallelLabel(fromDetails);
    if (parallel) return parallel;
  }
  if (variantLabel?.trim()) {
    const parallel = matchParallelLabel(variantLabel);
    if (parallel) return parallel;
    return variantLabel.trim();
  }
  return "";
}

/** Promo column / badge — promo set marks separated from main version when possible. */
export function displayPrintPromo(
  card: Pick<ExtractedCard, "printStamps" | "details">,
  variantLabel?: string | null,
): string {
  const edition = resolvePrintEdition(card);
  if (edition?.id === "promo") return edition.label;
  const stamps = card.printStamps?.trim() ?? "";
  if (/\bpromo\b/i.test(stamps)) return stamps;
  if (variantLabel?.toLowerCase().includes("promo")) {
    return variantLabel.trim();
  }
  return "";
}

export function displayPrintVersionForSpecimen(specimen: ScanSpecimen): string {
  const version = displayPrintVersion(specimen.card, specimen.context.variantLabel);
  return version || "—";
}

export function displayPrintPromoForSpecimen(specimen: ScanSpecimen): string {
  const promo = displayPrintPromo(specimen.card, specimen.context.variantLabel);
  return promo || "—";
}

export function hasPrintVersion(specimen: ScanSpecimen): boolean {
  return displayPrintVersion(specimen.card, specimen.context.variantLabel).length > 0;
}
