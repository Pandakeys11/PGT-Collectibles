"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  hasMinimumIdentityForCatalog,
  patchTouchesManualIdentity,
} from "@/lib/scan/catalog-merge";
import { buildScanCardContext } from "@/lib/scan/context-builder";
import {
  enrichExtractedCard,
  flushRuntimeCaches,
} from "@/lib/scan/enrich-client";
import {
  stabilizeOmniVisionCards,
  normalizeVisionGridLocation,
  pickPrimaryVisionCardFromCrop,
  type VisionGridLocation,
} from "@/lib/scan/spatial";
import { classifyCardLane } from "@/lib/scan/lane";
import {
  CARD_EVIDENCE_VISION_RADIUS_MULTIPLIER,
  clampCropRadiusMultiplier,
  extractCardRegionDataUrl,
  getNaturalImageSize,
  mapVisionLocationFromSubCropToParent,
  type EvidenceCropAdjustment,
} from "@/lib/scan/specimen-crop";
import {
  isScanLimitError,
  scanLimitMessage,
  type ScanLimitPayload,
} from "@/lib/scan/scan-limit-error";
import {
  buildSpecimensFromVisionCards,
  resolveSpecimensWithLaneFallback,
} from "@/lib/scan/build-specimens";
import { buildSpecimenFromCatalogPrefill } from "@/lib/scan/build-catalog-specimen";
import type { CatalogScanPrefill } from "@/lib/scan/catalog-bridge";
import { normalizeGradedSlabFields } from "@/lib/scan/graded-slab";
import { normalizeVisionCard } from "@/lib/scan/normalize-extracted-card";
import {
  extractedCardSchema,
  type CatalogCandidate,
  type ExtractedCard,
  type ScanCardContext,
} from "@/lib/scan/schemas";
import {
  getVisionClientTimeoutMs,
  getVisionConcurrency,
  readImageFileAsDataUrl,
  runVisionExtraction,
  runVisionOnSingleCardCrop,
} from "@/lib/scan/vision-client";

export type ScanLaneMode = "all" | "raw" | "graded";

export type ScanImageSlot = {
  id: string;
  previewUrl: string;
  file: File;
};

export type ScanSpecimen = {
  id: string;
  card: ExtractedCard;
  context: ScanCardContext;
  previewUrl: string | null;
  /** Crop center on 0–1000 grid aligned to extracted row order within this capture (fixes multi-card drift). */
  evidenceCropLocation: VisionGridLocation | null;
  /** Manual crop center on the full upload; when set, overrides `evidenceCropLocation` for previews. */
  userEvidenceCropCenter: VisionGridLocation | null;
  /** Manual frame size; when set, overrides default `CARD_EVIDENCE_VISION_RADIUS_MULTIPLIER`. */
  userEvidenceCropRadiusMultiplier: number | null;
};

export function getEffectiveEvidenceCenter(
  item: ScanSpecimen,
): VisionGridLocation {
  return (
    item.userEvidenceCropCenter ??
    item.evidenceCropLocation ??
    normalizeVisionGridLocation(item.card.location) ??
    ([500, 500] as const)
  );
}

export function getEffectiveEvidenceRadiusMultiplier(
  item: ScanSpecimen,
): number {
  return (
    item.userEvidenceCropRadiusMultiplier ??
    CARD_EVIDENCE_VISION_RADIUS_MULTIPLIER
  );
}

function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function normalizeCertLines(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function identityCompleteness(card: ExtractedCard): number {
  let score = 0;
  if (
    card.name?.trim() &&
    !/^unknown|resolving identity$/i.test(card.name.trim())
  )
    score += 2;
  if (card.set?.trim() && !/^unknown|pending$/i.test(card.set.trim()))
    score += 2;
  if (card.number?.trim()) score += 3;
  if (card.year?.trim()) score += 1;
  if (card.rarity?.trim()) score += 1;
  if (card.printStamps?.trim()) score += 1;
  return score;
}

function shouldRunPrecisionCrop(item: ScanSpecimen): boolean {
  if (!item.previewUrl) return false;
  const c = item.card;
  if (!c.name?.trim() || /^unknown|resolving identity$/i.test(c.name.trim()))
    return true;
  if (!c.number?.trim()) return true;
  if (!c.set?.trim() || /^unknown|pending$/i.test(c.set.trim())) return true;
  return identityCompleteness(c) < 6;
}

function mergePrecisionCard(
  base: ExtractedCard,
  crop: ExtractedCard,
): ExtractedCard {
  const merged: ExtractedCard = { ...base };
  const keys: Array<keyof ExtractedCard> = [
    "name",
    "printedName",
    "language",
    "set",
    "number",
    "year",
    "rarity",
    "printStamps",
    "details",
    "grader",
    "grade",
    "cert",
    "labelTitle",
    "encapsulation",
  ];
  for (const key of keys) {
    const value = crop[key];
    if (typeof value === "string" && value.trim()) {
      (merged as Record<string, unknown>)[key] = value;
    }
  }
  if (typeof crop.extractedPrice === "number")
    merged.extractedPrice = crop.extractedPrice;
  if (crop.stickerNote?.trim()) merged.stickerNote = crop.stickerNote;
  if (crop.bbox) merged.bbox = crop.bbox;
  return extractedCardSchema.parse(merged);
}

export function useScanSession() {
  const [laneMode, setLaneMode] = useState<ScanLaneMode>("all");
  const [slots, setSlots] = useState<ScanImageSlot[]>([]);
  const [specimens, setSpecimens] = useState<ScanSpecimen[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanLimit, setScanLimit] = useState<ScanLimitPayload | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [rescanningId, setRescanningId] = useState<string | null>(null);
  const [enrichingSpecimenId, setEnrichingSpecimenId] = useState<string | null>(
    null,
  );

  const specimensRef = useRef(specimens);
  specimensRef.current = specimens;
  const enrichDebounceRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const enrichRunRef = useRef<Map<string, number>>(new Map());
  const rescanRunRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const debounceMap = enrichDebounceRef.current;
    return () => {
      debounceMap.forEach((timer) => clearTimeout(timer));
      debounceMap.clear();
    };
  }, []);

  const cancelPendingEnrich = useCallback(() => {
    enrichDebounceRef.current.forEach((timer) => clearTimeout(timer));
    enrichDebounceRef.current.clear();
    enrichRunRef.current.clear();
    setEnrichingSpecimenId(null);
  }, []);

  const cancelEnrichForSpecimen = useCallback((id: string) => {
    const pending = enrichDebounceRef.current.get(id);
    if (pending) {
      clearTimeout(pending);
      enrichDebounceRef.current.delete(id);
    }
    enrichRunRef.current.set(id, (enrichRunRef.current.get(id) ?? 0) + 1);
    setEnrichingSpecimenId((current) => (current === id ? null : current));
  }, []);

  const selected = useMemo(
    () => specimens.find((item) => item.id === selectedId) ?? null,
    [specimens, selectedId],
  );

  const totals = useMemo(() => {
    const verifiedFmv = specimens.reduce(
      (sum, item) => sum + (item.context.fairValueUsd ?? 0),
      0,
    );
    const asking = specimens.reduce(
      (sum, item) => sum + (item.context.askingUsd ?? 0),
      0,
    );
    return { count: specimens.length, verifiedFmv, asking };
  }, [specimens]);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files).filter((file) =>
      file.type.startsWith("image/"),
    );
    const next = await Promise.all(
      list.map(async (file) => ({
        id: makeId("slot"),
        file,
        previewUrl: await readImageFileAsDataUrl(file),
      })),
    );
    setSlots((current) => [...current, ...next]);
  }, []);

  const removeSlot = useCallback((id: string) => {
    setSlots((current) => current.filter((slot) => slot.id !== id));
  }, []);

  const ingestCertMatrix = useCallback((raw: string) => {
    const lines = normalizeCertLines(raw);
    const next = lines.map((line) => {
      const digits = line.replace(/\D/g, "");
      const card = extractedCardSchema.parse({
        name: digits.length >= 6 ? "Resolving identity" : line,
        set: digits.length >= 6 ? "Registry lookup pending" : "Pending",
        cert: digits.length >= 6 ? digits : undefined,
        grader: /psa|cgc|bgs|sgc/i.test(line)
          ? line.match(/psa|cgc|bgs|sgc/i)?.[0]?.toUpperCase()
          : undefined,
        encapsulation: "graded_slab",
        visionLane: "graded",
      });
      const id = makeId("specimen");
      return {
        id,
        card,
        context: buildScanCardContext({ specimenId: id, card }),
        previewUrl: null,
        evidenceCropLocation: null,
        userEvidenceCropCenter: null,
        userEvidenceCropRadiusMultiplier: null,
      } satisfies ScanSpecimen;
    });
    setSpecimens((current) => [...current, ...next]);
    if (next[0]) setSelectedId(next[0].id);
  }, []);

  const enrichSpecimens = useCallback(async (items: ScanSpecimen[]) => {
    if (items.length === 0) return;
    setEnriching(true);
    const total = items.length;
    let completed = 0;
    try {
      const catalogConcurrency = 6;
      for (
        let offset = 0;
        offset < items.length;
        offset += catalogConcurrency
      ) {
        const chunk = items.slice(offset, offset + catalogConcurrency);
        await Promise.all(
          chunk.map(async (specimen) => {
            try {
              const result = await enrichExtractedCard({
                specimenId: specimen.id,
                card: specimen.card,
                phase: "catalog",
              });
              setSpecimens((current) =>
                current.map((entry) =>
                  entry.id === specimen.id
                    ? { ...entry, card: result.card, context: result.context }
                    : entry,
                ),
              );
            } catch {
              // Keep extracted row if catalog match fails.
            } finally {
              completed += 1;
              setProgress(`Matching catalog ${completed}/${total}`);
            }
          }),
        );
      }

      completed = 0;
      const marketConcurrency = 4;
      for (let offset = 0; offset < items.length; offset += marketConcurrency) {
        const chunk = items.slice(offset, offset + marketConcurrency);
        await Promise.all(
          chunk.map(async (specimen) => {
            const latest = specimensRef.current.find(
              (entry) => entry.id === specimen.id,
            );
            if (!latest) return;
            try {
              const result = await enrichExtractedCard({
                specimenId: latest.id,
                card: latest.card,
                phase: "market",
                catalogId: latest.context.catalogId,
                catalogImageUrl: latest.context.catalogImageUrl,
                skipCache: true,
              });
              setSpecimens((current) =>
                current.map((entry) =>
                  entry.id === latest.id
                    ? { ...entry, card: result.card, context: result.context }
                    : entry,
                ),
              );
            } catch {
              // Keep catalog-enriched row if market research fails.
            } finally {
              completed += 1;
              setProgress(`Market research ${completed}/${total}`);
            }
          }),
        );
      }
    } finally {
      setEnriching(false);
      setProgress(null);
    }
  }, []);

  const runScan = useCallback(async () => {
    if (slots.length === 0) {
      setError("Add at least one image before scanning.");
      return;
    }
    setScanning(true);
    setEnriching(false);
    cancelPendingEnrich();
    setError(null);
    setScanLimit(null);
    setSpecimens([]);
    setSelectedId(null);
    setProgress("Running vision extraction...");
    void flushRuntimeCaches();
    try {
      const images = slots.map((slot) => slot.previewUrl);
      const specimensByImage = new Map<number, ScanSpecimen[]>();
      let visionCardCount = 0;

      const extracted = await runVisionExtraction(images, {
        timeoutMs: getVisionClientTimeoutMs(),
        concurrency: getVisionConcurrency(),
        onProgress: (state) => {
          setProgress(
            `Vision ${state.imagesDone}/${state.imagesTotal} (${state.mode})`,
          );
        },
        onImageComplete: (cards, imageIndex) => {
          visionCardCount += cards.length;
          const batch = buildSpecimensFromVisionCards(cards, laneMode, slots);
          if (batch.length === 0) return;
          specimensByImage.set(imageIndex, batch);
          const ordered = Array.from(specimensByImage.keys())
            .sort((a, b) => a - b)
            .flatMap((key) => specimensByImage.get(key) ?? []);
          setSpecimens(ordered);
          setSelectedId((current) => current ?? ordered[0]?.id ?? null);
          setProgress(
            `Extracted ${visionCardCount} card(s) — scanning remaining images…`,
          );
        },
      });

      const stabilizedCount = extracted.filter(
        (row) => row && typeof row === "object",
      ).length;
      let nextSpecimens = buildSpecimensFromVisionCards(
        extracted,
        laneMode,
        slots,
      );
      const { specimens: resolved, laneNotice } =
        resolveSpecimensWithLaneFallback(
          nextSpecimens,
          stabilizedCount,
          laneMode,
          slots,
          extracted,
        );
      nextSpecimens = resolved;

      if (nextSpecimens.length === 0) {
        setSpecimens([]);
        setSelectedId(null);
        setError(
          stabilizedCount > 0
            ? "Vision returned cards, but none could be normalized into the sheet. Try another photo or switch the lane filter to All."
            : "No cards were detected in the uploaded image. Try another photo or switch the lane filter to All.",
        );
        setProgress(null);
        return;
      }

      setSpecimens(nextSpecimens);
      setSelectedId(nextSpecimens[0]?.id ?? null);
      if (laneNotice) setError(laneNotice);

      const weakSpecimens = nextSpecimens.filter(shouldRunPrecisionCrop);
      if (weakSpecimens.length > 0) {
        setProgress(`Precision crop pass 0/${weakSpecimens.length}`);
        const refinedById = new Map<string, ScanSpecimen>();
        let completedPrecision = 0;
        const precisionConcurrency = 3;
        for (
          let offset = 0;
          offset < weakSpecimens.length;
          offset += precisionConcurrency
        ) {
          const chunk = weakSpecimens.slice(
            offset,
            offset + precisionConcurrency,
          );
          await Promise.all(
            chunk.map(async (item) => {
              try {
                if (!item.previewUrl) return;
                const extractedCrop = await runVisionOnSingleCardCrop(
                  item.previewUrl,
                  getEffectiveEvidenceCenter(item),
                  {
                    gradedSlab: item.context.lane === "graded",
                    radiusMultiplier:
                      getEffectiveEvidenceRadiusMultiplier(item),
                  },
                );
                const { cards } = stabilizeOmniVisionCards(
                  extractedCrop.map((row) =>
                    row && typeof row === "object" ? row : {},
                  ),
                );
                const rawRecord = pickPrimaryVisionCardFromCrop(
                  cards as Array<Record<string, unknown>>,
                );
                const normalized = normalizeVisionCard(rawRecord);
                if (!normalized) return;
                const merged = mergePrecisionCard(item.card, normalized);
                if (
                  identityCompleteness(merged) < identityCompleteness(item.card)
                )
                  return;
                const lane = classifyCardLane(merged);
                const card = extractedCardSchema.parse({
                  ...merged,
                  sourceImageIndex:
                    item.card.sourceImageIndex ?? merged.sourceImageIndex,
                  visionLane: lane.lane,
                  visionLaneConfidence: lane.confidence,
                });
                refinedById.set(item.id, {
                  ...item,
                  card,
                  context: buildScanCardContext({ specimenId: item.id, card }),
                });
              } catch {
                // Keep the full-page extraction when the precision pass cannot improve it.
              } finally {
                completedPrecision += 1;
                setProgress(
                  `Precision crop pass ${completedPrecision}/${weakSpecimens.length}`,
                );
              }
            }),
          );
        }
        if (refinedById.size > 0) {
          nextSpecimens = nextSpecimens.map(
            (item) => refinedById.get(item.id) ?? item,
          );
          setSpecimens(nextSpecimens);
        }
      }
      setProgress("Extraction complete — matching catalog…");
      void enrichSpecimens(nextSpecimens);
    } catch (err) {
      if (isScanLimitError(err)) {
        setScanLimit(err.payload);
        setError(scanLimitMessage(err.payload));
      } else {
        setScanLimit(null);
        setError(err instanceof Error ? err.message : String(err));
      }
      setProgress(null);
    } finally {
      setScanning(false);
    }
  }, [cancelPendingEnrich, enrichSpecimens, laneMode, slots]);

  const setUserEvidenceCrop = useCallback(
    (id: string, crop: EvidenceCropAdjustment | null) => {
      setSpecimens((current) =>
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                userEvidenceCropCenter: crop?.center ?? null,
                userEvidenceCropRadiusMultiplier: crop
                  ? clampCropRadiusMultiplier(crop.radiusMultiplier)
                  : null,
                evidenceCropLocation: crop ? null : item.evidenceCropLocation,
              }
            : item,
        ),
      );
    },
    [],
  );

  const rescanSpecimen = useCallback(
    async (id: string, cropOverride?: EvidenceCropAdjustment) => {
      if (scanning) {
        setError("Wait for the full-page scan to finish before resyncing a single card.");
        return;
      }

      const item = specimensRef.current.find((s) => s.id === id);
      if (!item?.previewUrl) {
        setError("This row has no source photo — run a capture scan first.");
        return;
      }

      const scanCenter =
        cropOverride?.center ?? getEffectiveEvidenceCenter(item);
      const scanRadius = clampCropRadiusMultiplier(
        cropOverride?.radiusMultiplier ??
          getEffectiveEvidenceRadiusMultiplier(item),
      );
      const manualFrame =
        cropOverride != null ||
        item.userEvidenceCropCenter != null ||
        item.userEvidenceCropRadiusMultiplier != null;

      const runId = (rescanRunRef.current.get(id) ?? 0) + 1;
      rescanRunRef.current.set(id, runId);
      const stale = () => rescanRunRef.current.get(id) !== runId;

      cancelEnrichForSpecimen(id);
      setRescanningId(id);
      setSelectedId(id);
      setError(null);
      setProgress("Re-extracting this card from your adjusted crop…");

      const applyCropToRow = () => {
        setSpecimens((current) =>
          current.map((s) =>
            s.id === id
              ? {
                  ...s,
                  userEvidenceCropCenter: scanCenter,
                  userEvidenceCropRadiusMultiplier: scanRadius,
                  evidenceCropLocation: manualFrame ? null : s.evidenceCropLocation,
                }
              : s,
          ),
        );
      };
      applyCropToRow();

      const previewUrl = item.previewUrl;

      try {
        const cropDataUrl = await extractCardRegionDataUrl(previewUrl, scanCenter, {
          gradedSlab: item.context.lane === "graded",
          radiusMultiplier: scanRadius,
          maxOutputSide: 2560,
          quality: 0.96,
        });
        if (!cropDataUrl) {
          throw new Error(
            "Could not crop this card from the photo — adjust the frame and try again.",
          );
        }
        if (stale()) return;

        async function visionPass(gradedSlab: boolean) {
          const extracted = await runVisionOnSingleCardCrop(previewUrl, scanCenter, {
            gradedSlab,
            radiusMultiplier: scanRadius,
          });
          const { cards } = stabilizeOmniVisionCards(
            extracted.map((row) => (row && typeof row === "object" ? row : {})),
          );
          const rawRecord = pickPrimaryVisionCardFromCrop(
            cards as Array<Record<string, unknown>>,
          );
          if (!rawRecord) return null;
          const normalized = normalizeVisionCard(rawRecord);
          if (!normalized) return null;
          return { rawRecord, normalized };
        }

        let gradedSlab = item.context.lane === "graded";
        let pass = await visionPass(gradedSlab);
        if (!pass) {
          throw new Error("Vision did not detect a card in this crop — widen the frame or re-center it.");
        }
        if (stale()) return;

        let lane = classifyCardLane(pass.normalized);
        if (
          (lane.lane === "graded") !== gradedSlab &&
          lane.confidence >= 0.75
        ) {
          gradedSlab = lane.lane === "graded";
          const retry = await visionPass(gradedSlab);
          if (retry) {
            pass = retry;
            lane = classifyCardLane(pass.normalized);
          }
        }
        if (stale()) return;

        const { rawRecord, normalized } = pass;
        let finalCenter: VisionGridLocation = scanCenter;
        if (!manualFrame) {
          const childLoc = normalizeVisionGridLocation(rawRecord.location);
          if (childLoc) {
            const { width, height } = await getNaturalImageSize(previewUrl);
            finalCenter = mapVisionLocationFromSubCropToParent(
              width,
              height,
              scanCenter,
              childLoc,
              { gradedSlab, radiusMultiplier: scanRadius },
            );
          }
        }

        const nextCard: ExtractedCard = extractedCardSchema.parse({
          ...normalized,
          location: finalCenter,
          sourceImageIndex:
            item.card.sourceImageIndex ?? normalized.sourceImageIndex,
          visionLane: lane.lane,
          visionLaneConfidence: lane.confidence,
        });

        const patchRow = (card: ExtractedCard, context: ScanCardContext) => {
          setSpecimens((current) =>
            current.map((s) =>
              s.id === id
                ? {
                    ...s,
                    previewUrl,
                    card,
                    context,
                    evidenceCropLocation: finalCenter,
                    userEvidenceCropCenter: finalCenter,
                    userEvidenceCropRadiusMultiplier: scanRadius,
                  }
                : s,
            ),
          );
        };

        patchRow(
          nextCard,
          buildScanCardContext({ specimenId: id, card: nextCard }),
        );
        if (stale()) return;

        setProgress("Matching catalog…");
        const catalogEnriched = await enrichExtractedCard({
          specimenId: id,
          card: nextCard,
          phase: "catalog",
          skipCache: true,
        });
        if (stale()) return;
        patchRow(catalogEnriched.card, catalogEnriched.context);

        setProgress("Loading market data…");
        const enriched = await enrichExtractedCard({
          specimenId: id,
          card: catalogEnriched.card,
          phase: "market",
          catalogId: catalogEnriched.context.catalogId,
          catalogImageUrl: catalogEnriched.context.catalogImageUrl,
          skipCache: true,
        });
        if (stale()) return;
        patchRow(enriched.card, enriched.context);
      } catch (err) {
        if (!stale()) {
          if (isScanLimitError(err)) {
            setScanLimit(err.payload);
            setError(scanLimitMessage(err.payload));
          } else {
            setScanLimit(null);
            setError(err instanceof Error ? err.message : String(err));
          }
        }
      } finally {
        if (!stale()) {
          setRescanningId(null);
          setProgress(null);
        }
      }
    },
    [cancelEnrichForSpecimen, scanning],
  );

  const runManualEnrich = useCallback(async (id: string) => {
    const item = specimensRef.current.find((s) => s.id === id);
    if (!item || !hasMinimumIdentityForCatalog(item.card)) return;

    const runId = (enrichRunRef.current.get(id) ?? 0) + 1;
    enrichRunRef.current.set(id, runId);
    setEnrichingSpecimenId(id);

    try {
      const catalogResult = await enrichExtractedCard({
        specimenId: id,
        card: item.card,
        phase: "catalog",
        skipCache: true,
      });
      if (enrichRunRef.current.get(id) !== runId) return;

      setSpecimens((current) =>
        current.map((s) =>
          s.id === id
            ? { ...s, card: catalogResult.card, context: catalogResult.context }
            : s,
        ),
      );

      const marketResult = await enrichExtractedCard({
        specimenId: id,
        card: catalogResult.card,
        phase: "market",
        catalogId: catalogResult.context.catalogId,
        catalogImageUrl: catalogResult.context.catalogImageUrl,
        skipCache: true,
      });
      if (enrichRunRef.current.get(id) !== runId) return;

      setSpecimens((current) =>
        current.map((s) =>
          s.id === id
            ? { ...s, card: marketResult.card, context: marketResult.context }
            : s,
        ),
      );
    } catch {
      // Keep the user's typed values; enrichment is best-effort on manual edit.
    } finally {
      if (enrichRunRef.current.get(id) === runId) {
        setEnrichingSpecimenId((current) => (current === id ? null : current));
      }
    }
  }, []);

  const scheduleManualEnrich = useCallback(
    (id: string) => {
      const map = enrichDebounceRef.current;
      const pending = map.get(id);
      if (pending) clearTimeout(pending);
      map.set(
        id,
        setTimeout(() => {
          map.delete(id);
          void runManualEnrich(id);
        }, 850),
      );
    },
    [runManualEnrich],
  );

  const flushManualEnrich = useCallback(
    (id: string) => {
      const map = enrichDebounceRef.current;
      const pending = map.get(id);
      if (pending) {
        clearTimeout(pending);
        map.delete(id);
      }
      void runManualEnrich(id);
    },
    [runManualEnrich],
  );

  const updateSpecimen = useCallback(
    (id: string, patch: Partial<ExtractedCard>) => {
      setSpecimens((current) =>
        current.map((item) => {
          if (item.id !== id) return item;
          let card = extractedCardSchema.parse({ ...item.card, ...patch });
          card = normalizeGradedSlabFields(card, item.context.lane);
          return {
            ...item,
            card,
            context: buildScanCardContext({
              specimenId: id,
              card,
              catalogId: item.context.catalogId,
              year: card.year ?? item.context.year,
              marketEvidence: item.context.marketEvidence,
              marketSourceLinks: item.context.marketSourceLinks,
              fairValueUsd: item.context.fairValueUsd,
              fairValueBasis: item.context.fairValueBasis,
              catalogImageUrl: item.context.catalogImageUrl ?? null,
            }),
          };
        }),
      );

      if (patchTouchesManualIdentity(patch)) {
        scheduleManualEnrich(id);
      }
    },
    [scheduleManualEnrich],
  );

  const refreshMarketForCatalogOverride = useCallback(
    async (id: string, card: ExtractedCard, catalogId: string, catalogImageUrl: string | null) => {
      const runId = (enrichRunRef.current.get(id) ?? 0) + 1;
      enrichRunRef.current.set(id, runId);
      setEnrichingSpecimenId(id);

      try {
        const marketResult = await enrichExtractedCard({
          specimenId: id,
          card,
          phase: "market",
          catalogId,
          catalogImageUrl,
          skipCache: true,
        });
        if (enrichRunRef.current.get(id) !== runId) return;

        setSpecimens((current) =>
          current.map((item) =>
            item.id === id
              ? { ...item, card: marketResult.card, context: marketResult.context }
              : item,
          ),
        );
      } catch {
        // User catalog overrides are applied immediately; market refresh is best-effort.
      } finally {
        if (enrichRunRef.current.get(id) === runId) {
          setEnrichingSpecimenId((current) => (current === id ? null : current));
        }
      }
    },
    [],
  );

  const confirmCatalogCandidate = useCallback(
    (id: string, candidate: CatalogCandidate) => {
      const currentItem = specimensRef.current.find((item) => item.id === id);
      if (!currentItem) return;
      const catalogImageUrl = candidate.imageSmallUrl ?? candidate.imageLargeUrl ?? null;
      const confirmedCard = normalizeGradedSlabFields(
        extractedCardSchema.parse({
          ...currentItem.card,
          name: candidate.name || currentItem.card.name,
          set: candidate.setName ?? currentItem.card.set,
          number: candidate.cardNumber ?? currentItem.card.number,
          year: candidate.year ?? currentItem.card.year,
          rarity: candidate.rarity ?? currentItem.card.rarity,
        }),
        currentItem.context.lane,
      );
      const orderedCandidates = [
        candidate,
        ...currentItem.context.catalogCandidates.filter((entry) => entry.catalogId !== candidate.catalogId),
      ];

      setSpecimens((current) =>
        current.map((item) => {
          if (item.id !== id) return item;
          return {
            ...item,
            card: confirmedCard,
            context: buildScanCardContext({
              specimenId: id,
              card: confirmedCard,
              catalogId: candidate.catalogId,
              catalogIdentityStatus: "confirmed",
              catalogConfidence: 1,
              catalogCandidates: orderedCandidates,
              catalogImageUrl,
              identityEvidence: item.context.identityEvidence,
            }),
          };
        }),
      );

      void refreshMarketForCatalogOverride(id, confirmedCard, candidate.catalogId, catalogImageUrl);
    },
    [refreshMarketForCatalogOverride],
  );

  const rejectCatalogCandidate = useCallback((id: string, catalogId: string) => {
    cancelEnrichForSpecimen(id);
    setSpecimens((current) =>
      current.map((item) => {
        if (item.id !== id) return item;
        const remainingCandidates = item.context.catalogCandidates.filter(
          (entry) => entry.catalogId !== catalogId,
        );
        const nextBest = remainingCandidates[0] ?? null;
        const rejectingActive = item.context.catalogId === catalogId;
        const nextCatalogId = rejectingActive ? null : item.context.catalogId;
        const nextStatus =
          nextCatalogId != null
            ? item.context.catalogIdentityStatus
            : remainingCandidates.length > 0
              ? "ambiguous"
              : "failed";
        const nextConfidence =
          nextCatalogId != null
            ? item.context.catalogConfidence
            : nextBest?.confidence ?? 0;

        return {
          ...item,
          context: buildScanCardContext({
            specimenId: id,
            card: item.card,
            catalogId: nextCatalogId,
            catalogIdentityStatus: nextStatus,
            catalogConfidence: nextConfidence,
            catalogCandidates: remainingCandidates,
            identityEvidence: item.context.identityEvidence,
            marketEvidence: item.context.marketEvidence,
            marketSourceLinks: item.context.marketSourceLinks,
            fairValueUsd: item.context.fairValueUsd,
            fairValueBasis: item.context.fairValueBasis,
            catalogImageUrl: rejectingActive ? null : item.context.catalogImageUrl ?? null,
          }),
        };
      }),
    );
  }, [cancelEnrichForSpecimen]);

  const removeSpecimen = useCallback((id: string) => {
    setRescanningId((current) => (current === id ? null : current));
    setSpecimens((current) => current.filter((item) => item.id !== id));
    setSelectedId((current) => (current === id ? null : current));
  }, []);

  const clearSession = useCallback(() => {
    cancelPendingEnrich();
    setSlots([]);
    setSpecimens([]);
    setSelectedId(null);
    setError(null);
    setProgress(null);
    setEnriching(false);
    setScanning(false);
    setRescanningId(null);
    void flushRuntimeCaches();
  }, [cancelPendingEnrich]);

  const ingestCatalogPrefill = useCallback(
    async (prefill: CatalogScanPrefill) => {
      const specimen = buildSpecimenFromCatalogPrefill(prefill);
      setSlots([]);
      setSpecimens([specimen]);
      setSelectedId(specimen.id);
      setError(null);
      setEnriching(true);
      setEnrichingSpecimenId(specimen.id);
      setProgress("Loading catalog & market data…");

      try {
        const catalogResult = await enrichExtractedCard({
          specimenId: specimen.id,
          card: specimen.card,
          phase: "catalog",
        });

        let row: ScanSpecimen = {
          ...specimen,
          card: catalogResult.card,
          context: {
            ...catalogResult.context,
            catalogId: prefill.catalogId,
            catalogIdentityStatus: "confirmed",
            catalogConfidence: Math.max(
              catalogResult.context.catalogConfidence,
              0.95,
            ),
            catalogImageUrl:
              prefill.catalogImageUrl ??
              catalogResult.context.catalogImageUrl ??
              null,
          },
        };
        setSpecimens([row]);

        const marketResult = await enrichExtractedCard({
          specimenId: row.id,
          card: row.card,
          phase: "market",
          catalogId: prefill.catalogId,
          catalogImageUrl: row.context.catalogImageUrl,
          skipCache: true,
        });

        row = {
          ...row,
          card: marketResult.card,
          context: {
            ...marketResult.context,
            catalogId: prefill.catalogId,
            catalogIdentityStatus: "confirmed",
            catalogImageUrl: row.context.catalogImageUrl,
          },
        };
        setSpecimens([row]);
        setProgress(null);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load card from catalog",
        );
        setProgress(null);
      } finally {
        setEnriching(false);
        setEnrichingSpecimenId(null);
      }
    },
    [],
  );

  return {
    laneMode,
    setLaneMode,
    slots,
    specimens,
    selected,
    selectedId,
    setSelectedId,
    scanning,
    enriching,
    rescanningId,
    enrichingSpecimenId,
    error,
    scanLimit,
    clearScanLimit: () => setScanLimit(null),
    progress,
    totals,
    addFiles,
    removeSlot,
    ingestCertMatrix,
    runScan,
    updateSpecimen,
    confirmCatalogCandidate,
    rejectCatalogCandidate,
    flushManualEnrich,
    rescanSpecimen,
    setUserEvidenceCrop,
    removeSpecimen,
    clearSession,
    ingestCatalogPrefill,
  };
}
