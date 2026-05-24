import {
  buildSpecimensFromVisionCards,
  type BuiltScanSpecimen,
  type ScanLaneMode,
} from "@/lib/scan/build-specimens";
import { enrichExtractedCard } from "@/lib/scan/enrich-client";
import { buildHudFromSpecimen } from "@/lib/pokegrade/hud-from-specimen";
import type { LiveScanResult } from "@/lib/pokegrade/types";
import { runVisionExtraction } from "@/lib/scan/vision-client";

export async function runLiveCardScan(args: {
  previewUrl: string;
  laneMode: ScanLaneMode;
  singleCard?: boolean;
}): Promise<LiveScanResult> {
  const { previewUrl, laneMode, singleCard = true } = args;

  const extracted = await runVisionExtraction([previewUrl], {
    singleCardCrop: singleCard,
    gradedFocus: laneMode === "graded",
    concurrency: 1,
  });

  const slots = [
    {
      id: `live-${Date.now()}`,
      previewUrl,
      file: new File([], "live-capture.jpg", { type: "image/jpeg" }),
    },
  ];

  const specimens = buildSpecimensFromVisionCards(extracted, laneMode, slots);
  if (specimens.length === 0) {
    throw new Error("No card detected — center the card in the visor and try again.");
  }

  const primary = specimens[0]!;
  const enriched = await enrichExtractedCard({
    specimenId: primary.id,
    card: primary.card,
    phase: "full",
    skipRegistry: true,
  });

  const specimen: BuiltScanSpecimen = {
    ...primary,
    card: enriched.card,
    context: enriched.context,
    previewUrl,
  };

  return {
    specimen,
    previewUrl,
    hud: buildHudFromSpecimen(specimen, "pgt"),
  };
}
