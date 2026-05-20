import type { ScanSpecimen } from "@/hooks/use-scan-session";
import { getCardDisplaySubtitle, getCardDisplayTitle } from "@/lib/scan/card-display";
import { formatGradedSlabTag, normalizeGradedSlabFields } from "@/lib/scan/graded-slab";
import { classifyCardLane } from "@/lib/scan/lane";

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function getAskingUsd(
  specimen: Pick<ScanSpecimen, "card" | "context">,
): number | null {
  const price = specimen.context.askingUsd ?? specimen.card.extractedPrice ?? null;
  if (price == null || !Number.isFinite(price)) return null;
  return price;
}

/** Compact sticker / ask for tables and row chrome (no note). */
export function formatAskingPriceCompact(
  specimen: Pick<ScanSpecimen, "card" | "context">,
): string {
  const price = getAskingUsd(specimen);
  return price == null ? "—" : formatUsd(price);
}

/** Full sticker / ask with optional note (detail panels). */
export function formatAskingPrice(
  specimen: Pick<ScanSpecimen, "card" | "context">,
): string {
  const price = getAskingUsd(specimen);
  if (price == null) return "—";
  const note = specimen.card.stickerNote?.trim();
  const base = formatUsd(price);
  return note ? `${base} · ${note}` : base;
}

export function isGradedSpecimen(
  specimen: Pick<ScanSpecimen, "card" | "context">,
): boolean {
  return specimen.context.lane === "graded" || classifyCardLane(specimen.card).lane === "graded";
}

export function formatSpecimenSubtitle(
  specimen: Pick<ScanSpecimen, "card" | "context">,
): string {
  const parts: string[] = [];
  const setLine = [specimen.card.set, specimen.card.number].filter(Boolean).join(" / ");
  if (setLine) parts.push(setLine);

  const slab = formatGradedSlabTag(specimen.card);
  if (slab) {
    parts.push(slab);
  } else if (specimen.card.grader || specimen.card.grade) {
    parts.push([specimen.card.grader, specimen.card.grade].filter(Boolean).join(" "));
  }

  return parts.join(" · ") || "Identity resolving";
}

export function formatSpecimenMetaLine(
  specimen: Pick<ScanSpecimen, "card" | "context">,
): string {
  const bits = [
    specimen.card.rarity,
    specimen.card.printStamps,
    !isGradedSpecimen(specimen) ? specimen.card.cert : null,
  ].filter(Boolean);
  return bits.join(" / ") || "No extra details";
}

type SavedAskingSource = {
  market_snapshot_json?: { askingUsd?: number | null } | null;
  raw_extraction_json?: unknown;
};

export function getSavedAskingUsd(card: SavedAskingSource): number | null {
  const snapshot = card.market_snapshot_json?.askingUsd;
  if (snapshot != null && Number.isFinite(snapshot)) return snapshot;

  const raw = card.raw_extraction_json as
    | {
        card?: { extractedPrice?: number | null };
        context?: { askingUsd?: number | null };
      }
    | null
    | undefined;
  const fromContext = raw?.context?.askingUsd;
  if (fromContext != null && Number.isFinite(fromContext)) return fromContext;
  const fromCard = raw?.card?.extractedPrice;
  if (fromCard != null && Number.isFinite(fromCard)) return fromCard;
  return null;
}

export function formatSavedAskingUsd(card: SavedAskingSource): string {
  const price = getSavedAskingUsd(card);
  if (price == null) return "—";
  return formatUsd(price);
}

export function formatSavedCardMetaLine(card: {
  name?: string | null;
  printed_name?: string | null;
  language?: string | null;
  rarity: string | null;
  print_stamps: string | null;
  cert: string | null;
  grader: string | null;
  grade: string | null;
}): string {
  const graded =
    Boolean(card.grader || card.grade) ||
    Boolean(card.cert && card.cert.replace(/\D/g, "").length >= 6);
  const identity = getCardDisplaySubtitle(card);
  const bits = [identity, card.rarity, card.print_stamps, !graded ? card.cert : null].filter(Boolean);
  return bits.join(" / ") || "No extra details";
}

export function formatSavedCardTitle(card: {
  name?: string | null;
  printed_name?: string | null;
  language?: string | null;
}): string {
  return getCardDisplayTitle(card);
}

export function formatSavedGradedLine(card: {
  grader: string | null;
  grade: string | null;
  cert: string | null;
}): string {
  const gradedHint =
    card.grader || card.grade || (card.cert && card.cert.replace(/\D/g, "").length >= 6)
      ? ("graded" as const)
      : ("raw" as const);
  const normalized = normalizeGradedSlabFields(
    {
      name: "Card",
      grader: card.grader ?? undefined,
      grade: card.grade ?? undefined,
      cert: card.cert ?? undefined,
      encapsulation: gradedHint === "graded" ? "graded_slab" : "raw",
    },
    gradedHint,
  );
  return formatGradedSlabTag(normalized, gradedHint) ?? "-";
}
