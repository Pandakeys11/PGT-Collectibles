import { hasCatalogIdentityFields } from "@/lib/scan/card-display";
import { CERT_NOT_VISIBLE } from "@/lib/scan/graded-slab";
import { parseStructuredSlabLabel } from "@/lib/scan/slab-label-parse";
import type { ExtractedCard } from "@/lib/scan/schemas";
import { slabzPackFranchise } from "@/lib/slabz/pack-art";
import type { SlabzCard, SlabzPack } from "@/lib/slabz/types";

const GRADER_TOKENS =
  /\b(psa|cgc|bgs|bvg|sgc|ace|tag|hga|gma|certified|guarantee|company|prismatic|pristine|gem\s*mint|black\s*label)\b/i;

/** Vision often mis-reads the holder label as the card name. */
export function isSlabzGraderBoilerplateName(name: string | undefined | null): boolean {
  const n = (name ?? "").trim();
  if (n.length < 6) return true;
  if (/cert\s+on\s+back|enter\s+manually/i.test(n)) return true;

  const alphaChunks = n.replace(GRADER_TOKENS, " ").replace(/[^a-zA-Z]/g, " ").trim();
  const words = alphaChunks.split(/\s+/).filter((w) => w.length >= 3);
  if (words.length === 0) return true;
  if (words.length === 1 && /^(pristine|prismatic|mint|slab)$/i.test(words[0]!)) return true;

  const lower = n.toLowerCase();
  const hasGrader = /\b(psa|cgc|bgs|bvg|sgc)\b/i.test(n);
  const hasCardLike =
    /\b(ex|gx|vmax|vstar|lv\.?\s*x|art\s*rare|holo|promo|pikachu|charizard|mimikyu|rocket)\b/i.test(
      lower,
    ) || /\b(pokémon|pokemon|one\s*piece)\b/i.test(lower);

  if (hasGrader && !hasCardLike && n.length < 80) {
    const withoutGrader = n.replace(GRADER_TOKENS, "").trim();
    if (withoutGrader.length < 4 || /^[\d.\s·]+$/.test(withoutGrader)) return true;
  }

  return false;
}

function stripTrailingGraderFromName(raw: string): string {
  return raw
    .replace(/\s*[-·|]\s*(PSA|CGC|BGS|BVG|SGC|ACE|TAG)\b[\s\S]*$/i, "")
    .replace(/\s+\b(PSA|CGC|BGS)\s+[\d.]+\b.*$/i, "")
    .trim();
}

function certFromSlabzCard(card: SlabzCard): string | undefined {
  const serial = card.serialNumber?.trim();
  if (!serial) return CERT_NOT_VISIBLE;
  const digits = serial.replace(/\D/g, "");
  if (digits.length >= 6 && digits.length <= 12) return digits;
  return CERT_NOT_VISIBLE;
}

function gradeFromSlabz(card: SlabzCard): string | undefined {
  if (card.grade?.trim()) return card.grade.trim();
  const g = card.gradeNum?.trim();
  return g || undefined;
}

function graderFromSlabz(card: SlabzCard, labelBlob: string): string | undefined {
  if (card.gradingCompany?.trim()) return card.gradingCompany.trim().toUpperCase();
  const m = labelBlob.match(/\b(PSA|CGC|BGS|BVG|SGC|ACE|TAG|HGA|GMA)\b/i);
  return m?.[1]?.toUpperCase();
}

/**
 * Build a Liquid Scan–compatible graded card from Slabz partner `card` payload
 * (uses slab label parsing — not raw vision on the slab photo).
 */
export function parseSlabzCardToExtractedCard(
  card: SlabzCard,
  opts?: { packName?: string | null; pack?: SlabzPack | null },
): ExtractedCard {
  const franchise = slabzPackFranchise(
    opts?.pack ?? { ccPackType: card.category, name: card.name, priceCents: 0 },
  );
  const labelTitle = card.name?.trim() || "";
  const parsed = parseStructuredSlabLabel(labelTitle, card.category ?? undefined);

  let name = parsed.name?.trim();
  if (!name || isSlabzGraderBoilerplateName(name)) {
    const stripped = stripTrailingGraderFromName(labelTitle);
    if (stripped && !isSlabzGraderBoilerplateName(stripped)) {
      name = stripped;
    }
  }
  if (!name || isSlabzGraderBoilerplateName(name)) {
    name = "Graded slab";
  }

  const fmvUsd = card.insuredValueCents != null ? card.insuredValueCents / 100 : null;
  const isJapanese =
    /japanese|japan|日本/i.test(labelTitle) ||
    /japanese|japan/i.test(card.category ?? "");

  return {
    franchise,
    name,
    printedName: isJapanese && parsed.name ? parsed.name : card.name?.trim() || undefined,
    language: parsed.language ?? (isJapanese ? "Japanese" : undefined),
    set: parsed.set ?? undefined,
    number: parsed.number ?? undefined,
    year: parsed.year ?? (card.year != null ? String(card.year) : undefined),
    rarity: card.rarity ?? undefined,
    grader: parsed.grader ?? graderFromSlabz(card, labelTitle),
    grade: parsed.grade ?? gradeFromSlabz(card),
    cert: certFromSlabzCard(card),
    labelTitle: labelTitle.length >= 8 ? labelTitle : undefined,
    encapsulation: "graded_slab",
    visionLane: "graded",
    gradedEstimate: fmvUsd,
    details: [
      "Slabz partner rip",
      card.nftMint ? `NFT ${card.nftMint}` : null,
      fmvUsd != null ? `Insured FMV $${fmvUsd.toFixed(2)}` : null,
    ]
      .filter(Boolean)
      .join(" · "),
  };
}

export function isSlabzPartnerExtraction(
  extraction: Record<string, unknown> | undefined | null,
): boolean {
  return extraction?.partner === "slabz";
}

export function slabzCardFromExtraction(
  extraction: Record<string, unknown> | undefined | null,
): SlabzCard | null {
  const raw = extraction?.slabzCard;
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  if (typeof c.name !== "string" || !c.name.trim()) return null;
  return {
    nftMint: String(c.nftMint ?? ""),
    name: c.name,
    rarity: (c.rarity as SlabzCard["rarity"]) ?? "rare",
    insuredValueCents: Number(c.insuredValueCents ?? 0),
    imageUrl: String(c.imageUrl ?? ""),
    imageBackUrl: typeof c.imageBackUrl === "string" ? c.imageBackUrl : null,
    grade: typeof c.grade === "string" ? c.grade : null,
    gradeNum: typeof c.gradeNum === "string" ? c.gradeNum : null,
    gradingCompany: typeof c.gradingCompany === "string" ? c.gradingCompany : null,
    year: typeof c.year === "number" ? c.year : null,
    category: typeof c.category === "string" ? c.category : null,
    serialNumber: typeof c.serialNumber === "string" ? c.serialNumber : null,
  };
}

/** Prefer Slabz partner fields when vision/regression polluted the row. */
export function mergeVisionWithSlabzPartnerCard(
  visionCard: ExtractedCard,
  slabzCard: SlabzCard,
  opts?: { packName?: string | null; pack?: SlabzPack | null },
): ExtractedCard {
  const baseline = parseSlabzCardToExtractedCard(slabzCard, opts);
  const visionNameBad = isSlabzGraderBoilerplateName(visionCard.name);
  const visionWeak = !hasCatalogIdentityFields(visionCard);

  if (!visionNameBad && !visionWeak) {
    return {
      ...baseline,
      ...visionCard,
      name: visionCard.name?.trim() || baseline.name,
      labelTitle: visionCard.labelTitle ?? baseline.labelTitle,
      encapsulation: "graded_slab",
      visionLane: "graded",
    };
  }

  return {
    ...baseline,
    bbox: visionCard.bbox,
    location: visionCard.location,
    sourceImageIndex: visionCard.sourceImageIndex,
    labelTitle: visionCard.labelTitle?.trim()
      ? visionCard.labelTitle
      : baseline.labelTitle,
  };
}
