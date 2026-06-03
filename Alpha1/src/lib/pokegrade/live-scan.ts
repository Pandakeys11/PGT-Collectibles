import {
  buildSpecimensFromVisionCards,
  type BuiltScanSpecimen,
  type ScanLaneMode,
} from "@/lib/scan/build-specimens";
import {
  runCatalogEnrichSession,
  type SessionEnrichSpecimen,
} from "@/lib/scan/enrich-session-pipeline";
import { pickCatalogContext } from "@/lib/scan/context-builder";
import { enrichExtractedCard, fetchCatalogCandidates } from "@/lib/scan/enrich-client";
import { classifyCardLane } from "@/lib/scan/lane";
import { getLiquidScanSpeedProfile } from "@/lib/scan/liquid-scan-speed";
import { normalizeVisionCard } from "@/lib/scan/normalize-extracted-card";
import {
  hasCoreCatalogIdentity,
  identityCompleteness,
  mergePrecisionCard,
  needsPrecisionCrop,
  precisionCropImproves,
  type PrecisionCropSpecimen,
} from "@/lib/scan/precision-crop-policy";
import { CARD_EVIDENCE_VISION_RADIUS_MULTIPLIER } from "@/lib/scan/specimen-crop";
import { extractedCardSchema, type CatalogCandidate, type ExtractedCard } from "@/lib/scan/schemas";
import {
  normalizeVisionGridLocation,
  pickPrimaryVisionCardFromCrop,
  stabilizeOmniVisionCards,
} from "@/lib/scan/spatial";
import {
  runVisionExtraction,
  runVisionOnSingleCardCrop,
} from "@/lib/scan/vision-client";
import { buildHudFromSpecimen } from "@/lib/pokegrade/hud-from-specimen";
import {
  fetchPokeGradeHint,
  mergePokeGradeHint,
} from "@/lib/pokegrade/hint-client";
import {
  applyLiveCatalogConfirm,
  applyLiveCatalogReject,
} from "@/lib/pokegrade/live-catalog-selection";
import type { LiveScanResult } from "@/lib/pokegrade/types";

export type LiveScanPartial = Pick<LiveScanResult, "specimen" | "previewUrl" | "hud">;

const LIVE_VISION_TIMEOUT_MS = 75_000;
const LIVE_MARKET_TIMEOUT_MS = 58_000;

/** Live camera always uses speed-on enrich pacing (same as bulk scan speed mode). */
const LIVE_SPEED_PROFILE = getLiquidScanSpeedProfile(true);

function toLiveResult(specimen: BuiltScanSpecimen, previewUrl: string): LiveScanResult {
  return {
    specimen: { ...specimen, previewUrl },
    previewUrl,
    hud: buildHudFromSpecimen({ ...specimen, previewUrl }, "pgt"),
  };
}

function laneFromMode(laneMode: ScanLaneMode, card: ExtractedCard): "raw" | "graded" {
  if (laneMode === "graded") return "graded";
  if (laneMode === "raw") return "raw";
  return classifyCardLane(card).lane;
}

async function refineWithPrecisionCrop(
  evidenceUrl: string,
  card: ExtractedCard,
  laneMode: ScanLaneMode,
): Promise<ExtractedCard | null> {
  const center = normalizeVisionGridLocation(card.location) ?? [500, 500];
  const extracted = await runVisionOnSingleCardCrop(evidenceUrl, center, {
    gradedSlab: laneMode === "graded",
    radiusMultiplier: CARD_EVIDENCE_VISION_RADIUS_MULTIPLIER,
    timeoutMs: LIVE_VISION_TIMEOUT_MS,
  });
  const { cards } = stabilizeOmniVisionCards(
    extracted.map((row) => (row && typeof row === "object" ? row : {})),
  );
  const raw = pickPrimaryVisionCardFromCrop(cards as Array<Record<string, unknown>>);
  const normalized = normalizeVisionCard(raw);
  if (!normalized) return null;

  const merged = mergePrecisionCard(card, normalized);
  if (!precisionCropImproves(card, merged)) return null;

  const lane = classifyCardLane(merged);
  return extractedCardSchema.parse({
    ...merged,
    sourceImageIndex: card.sourceImageIndex ?? merged.sourceImageIndex,
    visionLane: lane.lane,
    visionLaneConfidence: lane.confidence,
  });
}

function shouldRunPrecisionCrop(
  primary: BuiltScanSpecimen,
  laneMode: ScanLaneMode,
): boolean {
  const probe: PrecisionCropSpecimen = {
    id: primary.id,
    previewUrl: primary.previewUrl,
    card: primary.card,
    context: { lane: laneFromMode(laneMode, primary.card) },
  };
  return needsPrecisionCrop(probe) || !hasCoreCatalogIdentity(primary.card);
}

async function extractVisionSpecimen(args: {
  visionUrl: string;
  evidenceUrl: string;
  laneMode: ScanLaneMode;
}): Promise<BuiltScanSpecimen> {
  const { visionUrl, evidenceUrl, laneMode } = args;

  const [extracted, pokeHint] = await Promise.all([
    runVisionExtraction([visionUrl], {
      singleCardCrop: true,
      gradedFocus: laneMode === "graded",
      visionVerify: false,
      concurrency: 1,
      timeoutMs: LIVE_VISION_TIMEOUT_MS,
    }),
    fetchPokeGradeHint(evidenceUrl),
  ]);

  const slots = [{ previewUrl: evidenceUrl }];
  const specimens = buildSpecimensFromVisionCards(extracted, laneMode, slots);
  if (specimens.length === 0) {
    throw new Error("No card detected — center the card in the frame and try again.");
  }

  let primary = specimens[0]!;
  if (pokeHint) {
    primary = {
      ...primary,
      card: mergePokeGradeHint(primary.card, pokeHint),
    };
  }

  return primary;
}

async function matchLiveCatalog(
  specimen: BuiltScanSpecimen,
  previewUrl: string,
): Promise<BuiltScanSpecimen> {
  const row: SessionEnrichSpecimen = {
    id: specimen.id,
    card: specimen.card,
    context: specimen.context,
  };

  const catalogById = await runCatalogEnrichSession({
    items: [row],
    profile: LIVE_SPEED_PROFILE,
    skipRegistryOnBulk: true,
    deferMarket: true,
    onProgress: () => {},
    onSpecimensPatch: () => {},
  });

  const matched = catalogById.get(specimen.id) ?? row;
  return {
    ...specimen,
    card: matched.card,
    context: matched.context,
    previewUrl,
  };
}

async function enrichLiveMarket(
  catalogSpecimen: BuiltScanSpecimen,
  previewUrl: string,
): Promise<BuiltScanSpecimen> {
  const catalogCtx = pickCatalogContext(catalogSpecimen.context);
  const marketResult = await enrichExtractedCard({
    specimenId: catalogSpecimen.id,
    card: catalogSpecimen.card,
    phase: "market",
    timeoutMs: LIVE_MARKET_TIMEOUT_MS,
    skipCache: true,
    skipRegistry: true,
    ...catalogCtx,
  });

  return {
    ...catalogSpecimen,
    card: marketResult.card,
    context: {
      ...marketResult.context,
      ...catalogCtx,
      catalogId: catalogCtx.catalogId ?? marketResult.context.catalogId,
      catalogImageUrl: catalogCtx.catalogImageUrl ?? marketResult.context.catalogImageUrl,
    },
    previewUrl,
  };
}

async function resolveCatalogWithOptionalPrecision(args: {
  primary: BuiltScanSpecimen;
  evidenceUrl: string;
  laneMode: ScanLaneMode;
  onCatalogReady?: (partial: LiveScanPartial) => void;
}): Promise<BuiltScanSpecimen> {
  const { primary, evidenceUrl, laneMode, onCatalogReady } = args;
  const runPrecision = shouldRunPrecisionCrop(primary, laneMode);

  const catalogPromise = matchLiveCatalog(primary, evidenceUrl);
  const precisionPromise = runPrecision
    ? refineWithPrecisionCrop(evidenceUrl, primary.card, laneMode)
    : Promise.resolve(null);

  const catalogFromPrimary = await catalogPromise;
  onCatalogReady?.(toLiveResult(catalogFromPrimary, evidenceUrl));

  const refined = await precisionPromise;
  if (!refined || !precisionCropImproves(primary.card, refined)) {
    return catalogFromPrimary;
  }

  const improvedPrimary = { ...primary, card: refined };
  const shouldRematch =
    !hasCoreCatalogIdentity(primary.card) ||
    identityCompleteness(refined) > identityCompleteness(catalogFromPrimary.card);

  if (!shouldRematch) {
    return catalogFromPrimary;
  }

  const rematched = await matchLiveCatalog(improvedPrimary, evidenceUrl);
  onCatalogReady?.(toLiveResult(rematched, evidenceUrl));
  return rematched;
}

/**
 * Live camera scan — eBay-style matching first, market second:
 * vision + optional PokeGrade hint (parallel) → catalog match (fast HUD) → precision re-match if needed → market.
 */
export async function runLiveCardScan(args: {
  /** Full camera frame for vision (art, set symbol, collector number). */
  visionUrl: string;
  /** Guide crop for evidence preview + precision re-read. */
  evidenceUrl: string;
  laneMode: ScanLaneMode;
  onCatalogReady?: (partial: LiveScanPartial) => void;
  onMarketReady?: (result: LiveScanResult) => void;
}): Promise<LiveScanResult> {
  const { visionUrl, evidenceUrl, laneMode, onCatalogReady, onMarketReady } = args;

  const primary = await extractVisionSpecimen({ visionUrl, evidenceUrl, laneMode });
  const catalogSpecimen = await resolveCatalogWithOptionalPrecision({
    primary,
    evidenceUrl,
    laneMode,
    onCatalogReady,
  });

  const finalSpecimen = await enrichLiveMarket(catalogSpecimen, evidenceUrl);
  const result = toLiveResult(finalSpecimen, evidenceUrl);
  onMarketReady?.(result);
  return result;
}

/** User confirms a catalog candidate in the live HUD — re-fetch market for that ID. */
export async function confirmLiveCatalogCandidate(
  result: LiveScanResult,
  candidate: CatalogCandidate,
): Promise<LiveScanResult> {
  const confirmed = applyLiveCatalogConfirm(result, candidate);
  const withMarket = await enrichLiveMarket(confirmed.specimen, confirmed.previewUrl);
  return toLiveResult(withMarket, confirmed.previewUrl);
}

/** User rejects a catalog candidate — show next option without re-scanning. */
export function rejectLiveCatalogCandidate(
  result: LiveScanResult,
  catalogId: string,
): LiveScanResult {
  return applyLiveCatalogReject(result, catalogId);
}

/** Widen catalog search when live match is weak (same API as upload scan). */
export async function refreshLiveCatalogCandidates(
  result: LiveScanResult,
): Promise<LiveScanResult> {
  const { specimen, previewUrl } = result;
  const widen = await fetchCatalogCandidates({
    card: specimen.card,
    existingCandidates: specimen.context.catalogCandidates,
  });

  const updated: BuiltScanSpecimen = {
    ...specimen,
    context: {
      ...specimen.context,
      catalogCandidates: widen.candidates,
      catalogIdentityStatus: widen.catalogIdentityStatus,
      catalogConfidence: widen.candidates[0]?.confidence ?? specimen.context.catalogConfidence,
      catalogImageUrl:
        widen.candidates[0]?.imageSmallUrl ??
        widen.candidates[0]?.imageLargeUrl ??
        specimen.context.catalogImageUrl,
    },
  };

  return toLiveResult(updated, previewUrl);
}

/** Backfill market when a live specimen was saved before comps finished. */
export async function enrichLiveSpecimenMarket(
  specimen: BuiltScanSpecimen,
): Promise<BuiltScanSpecimen> {
  const previewUrl = specimen.previewUrl ?? "";
  return enrichLiveMarket(specimen, previewUrl);
}
