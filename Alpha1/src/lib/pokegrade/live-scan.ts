import {
  buildSpecimensFromVisionCards,
  type BuiltScanSpecimen,
  type ScanLaneMode,
} from "@/lib/scan/build-specimens";
import { enrichExtractedCard } from "@/lib/scan/enrich-client";
import { pickCatalogContext } from "@/lib/scan/context-builder";
import { buildHudFromSpecimen } from "@/lib/pokegrade/hud-from-specimen";
import type { LiveScanResult } from "@/lib/pokegrade/types";
import { runVisionExtraction } from "@/lib/scan/vision-client";

export type LiveScanPartial = Pick<LiveScanResult, "specimen" | "previewUrl" | "hud">;

export async function runLiveCardScan(args: {
  previewUrl: string;
  laneMode: ScanLaneMode;
  singleCard?: boolean;
  /** Fires after catalog match so HUD can update before market comps finish. */
  onCatalogReady?: (partial: LiveScanPartial) => void;
}): Promise<LiveScanResult> {
  const { previewUrl, laneMode, singleCard = true, onCatalogReady } = args;

  const extracted = await runVisionExtraction([previewUrl], {
    singleCardCrop: singleCard,
    gradedFocus: laneMode === "graded",
    visionVerify: false,
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
  const catalogResult = await enrichExtractedCard({
    specimenId: primary.id,
    card: primary.card,
    phase: "catalog",
    skipRegistry: true,
  });

  const catalogSpecimen: BuiltScanSpecimen = {
    ...primary,
    card: catalogResult.card,
    context: catalogResult.context,
    previewUrl,
  };

  onCatalogReady?.({
    specimen: catalogSpecimen,
    previewUrl,
    hud: buildHudFromSpecimen(catalogSpecimen, "pgt"),
  });

  const catalogCtx = pickCatalogContext(catalogResult.context);
  const marketResult = await enrichExtractedCard({
    specimenId: primary.id,
    card: catalogResult.card,
    phase: "market",
    ...catalogCtx,
    skipRegistry: true,
  });

  const specimen: BuiltScanSpecimen = {
    ...catalogSpecimen,
    card: marketResult.card,
    context: {
      ...marketResult.context,
      ...catalogCtx,
      catalogId: catalogCtx.catalogId ?? marketResult.context.catalogId,
      catalogImageUrl:
        catalogCtx.catalogImageUrl ?? marketResult.context.catalogImageUrl,
    },
    previewUrl,
  };

  return {
    specimen,
    previewUrl,
    hud: buildHudFromSpecimen(specimen, "pgt"),
  };
}
