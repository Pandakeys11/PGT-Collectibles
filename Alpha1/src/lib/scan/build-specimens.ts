import { buildScanCardContext } from "@/lib/scan/context-builder";
import { classifyCardLane } from "@/lib/scan/lane";
import { normalizeVisionCard } from "@/lib/scan/normalize-extracted-card";
import {
  coerceCaptureSetConsensus,
  coerceSouthernIslandsByRoster,
} from "@/lib/scan/set-identification";
import type { ExtractedCard, ScanCardContext } from "@/lib/scan/schemas";
import {
  inferGridLocation,
  normalizeVisionGridLocation,
  stabilizeOmniVisionCards,
  type VisionGridLocation,
} from "@/lib/scan/spatial";

export type ScanLaneMode = "all" | "raw" | "graded";

export type BuiltScanSpecimen = {
  id: string;
  card: ExtractedCard;
  context: ScanCardContext;
  previewUrl: string | null;
  evidenceCropLocation: VisionGridLocation | null;
  userEvidenceCropCenter: VisionGridLocation | null;
  userEvidenceCropRadiusMultiplier: number | null;
};

function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export type BuildSpecimensOptions = {
  /** Width ÷ height per capture index — improves 4×5 / 5×4 grid crops. */
  captureAspects?: ReadonlyMap<number, number>;
};

/** Turn stabilized vision rows into sheet specimens (per-capture consensus + grid crops). */
export function buildSpecimensFromVisionCards(
  rawCards: unknown[],
  laneMode: ScanLaneMode,
  slots: ReadonlyArray<{ previewUrl: string }>,
  options?: BuildSpecimensOptions,
): BuiltScanSpecimen[] {
  const aspectMap = options?.captureAspects ?? new Map<number, number>();
  const { cards } = stabilizeOmniVisionCards(
    rawCards.map((row) => (row && typeof row === "object" ? row : {})),
    {
      captureAspectRatio: (raw) => {
        const idx =
          typeof (raw as { sourceImageIndex?: number }).sourceImageIndex === "number"
            ? (raw as { sourceImageIndex: number }).sourceImageIndex
            : 0;
        return aspectMap.get(idx);
      },
    },
  );

  type PassRow = {
    card: ExtractedCard;
    lane: ReturnType<typeof classifyCardLane>;
    sourceIndex: number;
  };

  const pass: PassRow[] = [];
  for (const raw of cards) {
    const card = normalizeVisionCard(raw);
    if (!card) continue;
    const lane = classifyCardLane(card);
    if (laneMode !== "all") {
      if (laneMode === "raw" && lane.lane === "graded") continue;
      if (laneMode === "graded" && lane.lane === "raw") continue;
    }
    const sourceIndex = typeof card.sourceImageIndex === "number" ? card.sourceImageIndex : 0;
    pass.push({ card, lane, sourceIndex });
  }

  const rowsByCapture = new Map<number, PassRow[]>();
  for (const row of pass) {
    const bucket = rowsByCapture.get(row.sourceIndex) ?? [];
    bucket.push(row);
    rowsByCapture.set(row.sourceIndex, bucket);
  }
  rowsByCapture.forEach((group) => {
    let groupCards = coerceCaptureSetConsensus(group.map((row) => row.card));
    groupCards = coerceSouthernIslandsByRoster(groupCards);
    groupCards.forEach((card, index) => {
      group[index]!.card = card;
    });
  });

  const countByCapture = new Map<number, number>();
  for (const row of pass) {
    countByCapture.set(row.sourceIndex, (countByCapture.get(row.sourceIndex) ?? 0) + 1);
  }

  const posByCapture = new Map<number, number>();
  const nextSpecimens: BuiltScanSpecimen[] = [];
  for (const row of pass) {
    const { card, lane, sourceIndex } = row;
    const groupSize = countByCapture.get(sourceIndex) ?? 1;
    const positionInGroup = posByCapture.get(sourceIndex) ?? 0;
    posByCapture.set(sourceIndex, positionInGroup + 1);

    const detectedLocation = normalizeVisionGridLocation(card.location);
    const captureAspect = aspectMap.get(sourceIndex);
    const evidenceCropLocation: VisionGridLocation | null =
      detectedLocation ??
      (groupSize > 1
        ? inferGridLocation(positionInGroup, groupSize, captureAspect)
        : inferGridLocation(0, 1, captureAspect));

    const id = makeId("specimen");
    nextSpecimens.push({
      id,
      card: { ...card, visionLane: lane.lane, visionLaneConfidence: lane.confidence },
      context: buildScanCardContext({ specimenId: id, card }),
      previewUrl: slots[sourceIndex]?.previewUrl ?? slots[0]?.previewUrl ?? null,
      evidenceCropLocation,
      userEvidenceCropCenter: null,
      userEvidenceCropRadiusMultiplier: null,
    });
  }
  return nextSpecimens;
}

export function resolveSpecimensWithLaneFallback(
  specimens: BuiltScanSpecimen[],
  visionCardCount: number,
  laneMode: ScanLaneMode,
  slots: ReadonlyArray<{ previewUrl: string }>,
  rawCards: unknown[],
): { specimens: BuiltScanSpecimen[]; laneNotice: string | null } {
  if (specimens.length > 0 || visionCardCount === 0 || laneMode === "all") {
    return { specimens, laneNotice: null };
  }
  const fallback = buildSpecimensFromVisionCards(rawCards, "all", slots);
  if (fallback.length === 0) {
    return { specimens, laneNotice: null };
  }
  return {
    specimens: fallback,
    laneNotice: `No ${laneMode} cards matched the current filter. Showing all ${fallback.length} extracted cards instead.`,
  };
}
