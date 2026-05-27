import {
  locationFromBboxGrid,
  normalizeVisionBboxGrid,
  scaleVisionGridCoord,
} from "@/lib/scan/spatial-grid";

export type VisionGridLocation = readonly [number, number];

export type OmniVisionSpatialCard = {
  sourceImageIndex?: number | null;
  visionBatchMerged?: boolean;
  cert?: string | null;
  location?: unknown;
};

export function inferSpecimenGridColumns(
  groupSize: number,
  aspectRatio?: number,
): number {
  if (groupSize <= 1) return 1;
  if (groupSize <= 4) return 2;
  if (groupSize <= 6) return aspectRatio != null && aspectRatio > 1.2 ? 3 : 2;
  if (aspectRatio != null && aspectRatio >= 1.15) {
    if (groupSize >= 18) return 5;
    if (groupSize >= 10) return 4;
    return 3;
  }
  // Portrait phone shots of table grids.
  if (groupSize <= 12) return 3;
  if (groupSize <= 16) return 4;
  if (groupSize <= 25) return 5;
  if (groupSize <= 30) return 6;
  return Math.min(8, Math.ceil(Math.sqrt(groupSize)));
}

export function isMissingVisionLocation(location: unknown): boolean {
  if (!Array.isArray(location) || location.length < 2) return true;
  const y = Number(location[0]);
  const x = Number(location[1]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return true;
  return y >= 995 && x >= 995;
}

export function normalizeVisionGridLocation(location: unknown): VisionGridLocation | undefined {
  if (isMissingVisionLocation(location)) return undefined;
  const y = scaleVisionGridCoord(Number((location as number[])[0]));
  const x = scaleVisionGridCoord(Number((location as number[])[1]));
  return [y, x] as const;
}

function normalizeVisionBboxCenter(bbox: unknown): VisionGridLocation | undefined {
  const grid = normalizeVisionBboxGrid(bbox);
  if (!grid) return undefined;
  return locationFromBboxGrid(grid);
}

/**
 * Cell center on a 0–1000 grid for the n-th card in a capture, reading **row-major**:
 * each **row** left→right, then the next row down (matches typical binder photos and how
 * vision models naturally list cards). Use with the same ordering in the vision prompt.
 */
export function inferGridLocation(
  indexInGroup: number,
  groupSize: number,
  aspectRatio?: number,
): VisionGridLocation {
  if (groupSize <= 0) return [500, 500] as const;
  const cols = inferSpecimenGridColumns(groupSize, aspectRatio);
  const rows = Math.max(1, Math.ceil(groupSize / cols));
  const row = Math.floor(indexInGroup / cols);
  const col = indexInGroup % cols;
  const cardsThisRow = row === rows - 1 ? groupSize - row * cols : cols;
  const colOffset = row === rows - 1 && cardsThisRow < cols ? (cols - cardsThisRow) / 2 : 0;
  const y = Math.round(((row + 0.5) / rows) * 1000);
  const x = Math.round(((col + colOffset + 0.5) / cols) * 1000);
  return [y, x] as const;
}

function captureGroupKey(card: OmniVisionSpatialCard): string {
  if (card.visionBatchMerged) return "merged";
  if (typeof card.sourceImageIndex === "number" && card.sourceImageIndex >= 0) {
    return `capture:${card.sourceImageIndex}`;
  }
  return "unknown";
}

function captureSortKey(card: OmniVisionSpatialCard): number {
  if (typeof card.sourceImageIndex === "number" && card.sourceImageIndex >= 0) {
    return card.sourceImageIndex;
  }
  if (card.visionBatchMerged) return 0;
  return 1_000_000;
}

function sanitizeDuplicateCertsInGroup<T extends OmniVisionSpatialCard>(
  cards: T[],
  warnings: string[],
): T[] {
  const seen = new Set<string>();
  return cards.map((card, index) => {
    const digits = String(card.cert ?? "").replace(/\D/g, "");
    if (digits.length < 6) return card;
    if (seen.has(digits)) {
      warnings.push(`Duplicate cert #${digits} on sheet — cleared on row ${index + 1}.`);
      return { ...card, cert: "" };
    }
    seen.add(digits);
    return card;
  });
}

/** When vision returns multiple hits on a tight single-card crop, pick the one nearest frame center. */
export function pickPrimaryVisionCardFromCrop<T extends { location?: unknown }>(cards: T[]): T | null {
  if (cards.length === 0) return null;
  if (cards.length === 1) return cards[0];
  let best = cards[0];
  let bestDist = Infinity;
  for (const card of cards) {
    const loc = normalizeVisionGridLocation(card.location);
    const dy = (loc?.[0] ?? 500) - 500;
    const dx = (loc?.[1] ?? 500) - 500;
    const d = dy * dy + dx * dx;
    if (d < bestDist) {
      bestDist = d;
      best = card;
    }
  }
  return best;
}

export function stabilizeOmniVisionCards<T extends OmniVisionSpatialCard>(
  cards: T[],
  options?: { captureAspectRatio?: (card: T) => number | undefined },
): {
  cards: T[];
  warnings: string[];
} {
  if (cards.length === 0) return { cards: [], warnings: [] };

  const warnings: string[] = [];
  const indexed = cards.map((card, index) => ({ card, index }));
  const sorted = indexed.sort((a, b) => {
    const pageDelta = captureSortKey(a.card) - captureSortKey(b.card);
    if (pageDelta !== 0) return pageDelta;
    // Same capture / page: preserve the model's card order so sheet row i matches evidence slot i
    // (row-major grids — left→right, top→bottom — match inferGridLocation and the vision prompt).
    return a.index - b.index;
  });

  const groupSizes = new Map<string, number>();
  for (const { card } of sorted) {
    const key = captureGroupKey(card);
    groupSizes.set(key, (groupSizes.get(key) ?? 0) + 1);
  }

  const groupPositions = new Map<string, number>();
  const ordered = sorted.map(({ card }) => {
    const key = captureGroupKey(card);
    const groupSize = groupSizes.get(key) ?? 1;
    const positionInGroup = groupPositions.get(key) ?? 0;
    groupPositions.set(key, positionInGroup + 1);

    let location = normalizeVisionGridLocation(card.location) ?? normalizeVisionBboxCenter((card as Record<string, unknown>).bbox);
    if (!location && groupSize > 1) {
      const aspect = options?.captureAspectRatio?.(card);
      location = inferGridLocation(positionInGroup, groupSize, aspect);
    }
    return location ? ({ ...card, location } as T) : card;
  });

  return {
    cards: sanitizeDuplicateCertsInGroup(ordered, warnings),
    warnings: Array.from(new Set(warnings)),
  };
}
