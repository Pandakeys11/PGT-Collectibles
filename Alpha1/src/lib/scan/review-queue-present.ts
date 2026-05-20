import type { ScanSpecimen } from "@/hooks/use-scan-session";
import type { CatalogCandidate } from "@/lib/scan/schemas";
import {
  catalogImageLookupName,
  getCardDisplaySubtitle,
  getCardDisplayTitle,
} from "@/lib/scan/card-display";

export type ReviewQueueCardDisplay = {
  fromCatalog: boolean;
  name: string;
  subtitle: string;
  meta: string;
  imageUrl: string | null;
  imageAlt: string;
  sourceLabel: "Catalog" | "Scan";
};

function catalogStatusIsDisplayable(status: ScanSpecimen["context"]["catalogIdentityStatus"]) {
  return status === "confirmed" || status === "likely";
}

function bestCatalogCandidate(item: ScanSpecimen): CatalogCandidate | null {
  const candidates = item.context.catalogCandidates;
  if (candidates.length === 0) return null;
  const catalogId = item.context.catalogId?.trim();
  return (
    (catalogId ? candidates.find((candidate) => candidate.catalogId === catalogId) : null) ??
    candidates[0] ??
    null
  );
}

function joinSubtitleParts(...parts: Array<string | null | undefined>): string {
  return parts.filter((part) => Boolean(part?.trim())).join(" · ");
}

export function getReviewQueueCardDisplay(item: ScanSpecimen): ReviewQueueCardDisplay {
  const candidate = bestCatalogCandidate(item);
  const hasCatalogMatch =
    catalogStatusIsDisplayable(item.context.catalogIdentityStatus) &&
    Boolean(item.context.catalogId || candidate);

  const displayTitle = getCardDisplayTitle(item.card);
  const identitySubtitle = getCardDisplaySubtitle(item.card);
  const imageAlt = `${displayTitle}${identitySubtitle ? ` (${identitySubtitle})` : ""}`;

  if (hasCatalogMatch) {
    const setLine = [
      candidate?.setName ?? item.context.setName ?? item.card.set,
      candidate?.cardNumber ?? item.context.cardNumber ?? item.card.number,
    ]
      .filter(Boolean)
      .join(" / ");
    const meta = [candidate?.year ?? item.context.year ?? item.card.year, candidate?.rarity ?? item.card.rarity]
      .filter(Boolean)
      .join(" / ");
    const imageUrl =
      item.context.catalogImageUrl?.trim() ||
      candidate?.imageSmallUrl?.trim() ||
      candidate?.imageLargeUrl?.trim() ||
      null;

    return {
      fromCatalog: true,
      name: displayTitle,
      subtitle: joinSubtitleParts(setLine, identitySubtitle) || "Matched master catalog card",
      meta: meta || "Official catalog match",
      imageUrl,
      imageAlt: `${catalogImageLookupName(item.card)} catalog artwork`,
      sourceLabel: "Catalog",
    };
  }

  const scanSubtitle = joinSubtitleParts(
    [item.card.set, item.card.number].filter(Boolean).join(" / ") || null,
    identitySubtitle,
  );
  const scanMeta = [item.card.rarity, item.card.printStamps, item.card.cert].filter(Boolean).join(" / ");

  return {
    fromCatalog: false,
    name: displayTitle,
    subtitle: scanSubtitle || "Identity resolving",
    meta: scanMeta || "No extra details",
    imageUrl: item.previewUrl,
    imageAlt,
    sourceLabel: "Scan",
  };
}
