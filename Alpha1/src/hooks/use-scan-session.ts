"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trackCompanionQuest } from "@/lib/companion/quest-tracker";
import { readImageNaturalSize } from "@/lib/scan/binder-grid-vision";
import {
  hasMinimumIdentityForCatalog,
  hasUserCatalogOverride,
  patchTouchesManualIdentity,
} from "@/lib/scan/catalog-merge";
import { buildScanCardContext, pickCatalogContext } from "@/lib/scan/context-builder";
import { readResponseJson } from "@/lib/http/read-response-json";
import {
  enrichExtractedCard,
  fetchCatalogCandidates,
  flushRuntimeCaches,
  recordScanObservation,
} from "@/lib/scan/enrich-client";
import {
  runCatalogEnrichSession,
  runMarketEnrichSession,
} from "@/lib/scan/enrich-session-pipeline";
import {
  stabilizeOmniVisionCards,
  normalizeVisionGridLocation,
  pickPrimaryVisionCardFromCrop,
  type VisionGridLocation,
} from "@/lib/scan/spatial";
import { inferCardFranchise } from "@/lib/scan/franchise";
import { classifyCardLane } from "@/lib/scan/lane";
import {
  CARD_EVIDENCE_VISION_RADIUS_MULTIPLIER,
  clampCropRadiusMultiplier,
  extractCardRegionDataUrl,
  getNaturalImageSize,
  mapVisionLocationFromSubCropToParent,
  type EvidenceCropAdjustment,
} from "@/lib/scan/specimen-crop";
import { normalizeVisionBboxGrid } from "@/lib/scan/spatial-grid";
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
import {
  hasReadableCertNumber,
  normalizeGradedSlabFields,
} from "@/lib/scan/graded-slab";
import { normalizeVisionCard } from "@/lib/scan/normalize-extracted-card";
import {
  getLiquidScanSpeedProfile,
  precisionCropMaxForCardCount,
} from "@/lib/scan/liquid-scan-speed";
import {
  mergePrecisionCard,
  precisionCropImproves,
  selectPrecisionCropCandidates,
} from "@/lib/scan/precision-crop-policy";
import {
  extractedCardSchema,
  type CatalogCandidate,
  type ExtractedCard,
  type ScanCardContext,
} from "@/lib/scan/schemas";
import type { LiveScanResult } from "@/lib/pokegrade/types";
import {
  getVisionClientTimeoutMs,
  readImageFileAsDataUrl,
  runVisionExtraction,
  runVisionOnSingleCardCrop,
} from "@/lib/scan/vision-client";
import type { ScanMode } from "@/lib/scanner-chat/types";
import {
  scanModeRequestsVisionVerify,
  scanModeUsesBinderGrid,
  scanModeUsesBinderUploadPrep,
  scanModeUsesSingleCardCrop,
} from "@/lib/scanner-chat/scan-mode-config";

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

function buildConfirmedCardFromCandidate(
  card: ExtractedCard,
  candidate: CatalogCandidate,
  lane: ScanCardContext["lane"],
): ExtractedCard {
  return normalizeGradedSlabFields(
    extractedCardSchema.parse({
      ...card,
      name: candidate.name || card.name,
      set: candidate.setName ?? card.set,
      number: candidate.cardNumber ?? card.number,
      year: candidate.year ?? card.year,
      rarity: candidate.rarity ?? card.rarity,
    }),
    lane,
  );
}

function buildContextForUserCatalogSelection(
  specimenId: string,
  card: ExtractedCard,
  candidate: CatalogCandidate,
  prior: ScanCardContext,
): ScanCardContext {
  const catalogImageUrl = candidate.imageSmallUrl ?? candidate.imageLargeUrl ?? null;
  const orderedCandidates = [
    candidate,
    ...prior.catalogCandidates.filter((entry) => entry.catalogId !== candidate.catalogId),
  ];
  return buildScanCardContext({
    specimenId,
    card,
    catalogId: candidate.catalogId,
    catalogIdentityStatus: "confirmed",
    catalogConfidence: 1,
    catalogCandidates: orderedCandidates,
    catalogImageUrl,
    identityEvidence: prior.identityEvidence,
    marketEvidence: prior.marketEvidence,
    marketSourceLinks: prior.marketSourceLinks,
    fairValueUsd: prior.fairValueUsd,
    fairValueBasis: prior.fairValueBasis,
    year: card.year ?? prior.year,
  });
}

export function useScanSession(options?: { speedOn?: boolean; scanMode?: ScanMode }) {
  const { userId } = useAuth();
  const speedOnRef = useRef(options?.speedOn ?? false);
  speedOnRef.current = options?.speedOn ?? false;
  const scanModeRef = useRef<ScanMode>(options?.scanMode ?? "binder");
  scanModeRef.current = options?.scanMode ?? "binder";
  const [laneMode, setLaneMode] = useState<ScanLaneMode>("all");
  const [slots, setSlots] = useState<ScanImageSlot[]>([]);
  const [specimens, setSpecimens] = useState<ScanSpecimen[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [marketEnriching, setMarketEnriching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanLimit, setScanLimit] = useState<ScanLimitPayload | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [rescanningId, setRescanningId] = useState<string | null>(null);
  const [enrichingSpecimenId, setEnrichingSpecimenId] = useState<string | null>(
    null,
  );
  const [catalogRefreshingId, setCatalogRefreshingId] = useState<string | null>(
    null,
  );
  const [uploadQueuedCount, setUploadQueuedCount] = useState(0);

  const specimensRef = useRef(specimens);
  specimensRef.current = specimens;

  useEffect(() => {
    marketEnrichingRef.current = marketEnriching;
  }, [marketEnriching]);
  const enrichDebounceRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const enrichRunRef = useRef<Map<string, number>>(new Map());
  const precisionRunRef = useRef(0);
  const marketEnrichGenRef = useRef(0);
  const marketEnrichingRef = useRef(false);
  const registryLoadRef = useRef<string | null>(null);
  const rescanRunRef = useRef<Map<string, number>>(new Map());
  /** Synchronous guard — blocks parallel runScan before React state updates. */
  const scanLockRef = useRef(false);
  const uploadQueueRef = useRef<File[]>([]);
  const uploadDrainRef = useRef(false);

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
    marketEnrichGenRef.current += 1;
    setEnrichingSpecimenId(null);
    setMarketEnriching(false);
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

  useEffect(() => {
    if (!selectedId) return;
    const item = specimensRef.current.find((s) => s.id === selectedId);
    if (!item || item.context.lane !== "graded") return;
    if (!hasReadableCertNumber(item.card.cert)) return;
    if (item.context.registryUrl || item.context.populationSummary) return;
    if (registryLoadRef.current === selectedId) return;

    const loadId = selectedId;
    registryLoadRef.current = loadId;
    void (async () => {
      try {
        const res = await fetch("/api/scan/registry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            card: item.card,
            specimenId: loadId,
            catalogId: item.context.catalogId,
          }),
        });
        const data = await readResponseJson<{
          card?: ExtractedCard;
          context?: ScanCardContext;
          populationSummary?: string | null;
          registryUrl?: string | null;
          certMarketEvidence?: ScanCardContext["certMarketEvidence"];
        }>(res);
        if (!res.ok || registryLoadRef.current !== loadId) return;
        setSpecimens((current) =>
          current.map((s) => {
            if (s.id !== loadId) return s;
            const nextContext = data.context ?? {
              ...s.context,
              populationSummary:
                data.populationSummary ?? s.context.populationSummary,
              registryUrl: data.registryUrl ?? s.context.registryUrl,
              certMarketEvidence:
                data.certMarketEvidence ?? s.context.certMarketEvidence,
            };
            const certRows = nextContext.certMarketEvidence ?? [];
            if (certRows.length > 0) {
              const seen = new Set<string>();
              nextContext.marketEvidence = [
                ...certRows,
                ...nextContext.marketEvidence,
              ].filter((it) => {
                const key = `${it.kind}|${it.url ?? ""}|${it.title}|${it.priceUsd ?? ""}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
              });
            }
            return {
              ...s,
              card: data.card ?? s.card,
              context: nextContext,
            };
          }),
        );
      } catch {
        // Registry is best-effort on selection.
      } finally {
        if (registryLoadRef.current === loadId) registryLoadRef.current = null;
      }
    })();
  }, [selectedId]);

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

  const ingestImageFiles = useCallback(async (files: File[]) => {
    const list = files.filter((file) => file.type.startsWith("image/"));
    if (list.length === 0) return;
    const mode = scanModeRef.current;
    const projectedSlots = slots.length + list.length;
    const binderPrep = scanModeUsesBinderUploadPrep(mode, projectedSlots, laneMode);
    const singlePrep =
      projectedSlots === 1 && scanModeUsesSingleCardCrop(mode, 1, laneMode);
    const next = await Promise.all(
      list.map(async (file) => ({
        id: makeId("slot"),
        file,
        previewUrl: await readImageFileAsDataUrl(file, {
          binderGrid: binderPrep,
          singleCard: singlePrep,
        }),
      })),
    );
    setSlots((current) => [...current, ...next]);
  }, [laneMode, slots.length]);

  const drainUploadQueue = useCallback(async () => {
    if (uploadDrainRef.current) return;
    uploadDrainRef.current = true;
    try {
      while (uploadQueueRef.current.length > 0) {
        if (scanLockRef.current) break;
        const batch = uploadQueueRef.current.splice(0, 8);
        await ingestImageFiles(batch);
      }
    } finally {
      uploadDrainRef.current = false;
      setUploadQueuedCount(uploadQueueRef.current.length);
      if (uploadQueueRef.current.length > 0 && !scanLockRef.current) {
        void drainUploadQueue();
      }
    }
  }, [ingestImageFiles]);

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files).filter((file) => file.type.startsWith("image/"));
      if (list.length === 0) return;
      if (scanLockRef.current) {
        uploadQueueRef.current.push(...list);
        setUploadQueuedCount(uploadQueueRef.current.length);
        return;
      }
      void (async () => {
        await ingestImageFiles(list);
        void drainUploadQueue();
      })();
    },
    [drainUploadQueue, ingestImageFiles],
  );

  const removeSlot = useCallback((id: string) => {
    setSlots((current) => current.filter((slot) => slot.id !== id));
  }, []);

  const reorderSlots = useCallback((from: number, to: number) => {
    setSlots((current) => {
      if (from === to || from < 0 || to < 0 || from >= current.length || to >= current.length) {
        return current;
      }
      const next = [...current];
      const [moved] = next.splice(from, 1);
      if (!moved) return current;
      next.splice(to, 0, moved);
      return next;
    });
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
    cancelPendingEnrich();
    const marketGen = ++marketEnrichGenRef.current;
    const total = items.length;
    const profile = getLiquidScanSpeedProfile(speedOnRef.current);
    const skipRegistryOnBulk = profile.skipRegistryOnBulkEnrich;

    setEnriching(true);
    setMarketEnriching(false);

    let catalogById = new Map<string, ScanSpecimen>();

    try {
      catalogById = await runCatalogEnrichSession({
        items,
        profile,
        skipRegistryOnBulk,
        deferMarket: true,
        onProgress: setProgress,
        onSpecimensPatch: setSpecimens,
      });
    } finally {
      setEnriching(false);
    }

    if (marketGen !== marketEnrichGenRef.current) return;

    setProgress("Catalog matched — loading market…");
    setMarketEnriching(true);

    try {
      await runMarketEnrichSession({
        items,
        profile,
        skipRegistryOnBulk,
        catalogById,
        onProgress: setProgress,
        onSpecimensPatch: setSpecimens,
      });
    } finally {
      if (marketGen === marketEnrichGenRef.current) {
        setMarketEnriching(false);
        setProgress(null);
      }
      if (userId && total > 0) {
        void trackCompanionQuest(userId, "scan_session", 1);
        void trackCompanionQuest(userId, "cards_scanned", total);
      }
    }
  }, [cancelPendingEnrich, userId]);

  const reEnrichAfterPrecision = useCallback(async (id: string, card: ExtractedCard) => {
    if (!hasMinimumIdentityForCatalog(card)) return;
    if (enriching) return;

    const prior = specimensRef.current.find((s) => s.id === id);
    const hadMarket =
      (prior?.context.marketEvidence.length ?? 0) > 0 ||
      prior?.context.fairValueUsd != null;

    try {
      const catalogResult = await enrichExtractedCard({
        specimenId: id,
        card,
        phase: "catalog",
        skipCache: true,
      });
      const catalogCtx = pickCatalogContext(catalogResult.context);
      setSpecimens((current) =>
        current.map((s) =>
          s.id === id
            ? { ...s, card: catalogResult.card, context: catalogResult.context }
            : s,
        ),
      );

      if (!hadMarket || !catalogCtx.catalogId) return;

      const skipRegistryOnBulk = getLiquidScanSpeedProfile(speedOnRef.current)
        .skipRegistryOnBulkEnrich;
      const skipRegistry =
        skipRegistryOnBulk &&
        !(
          prior?.context.lane === "graded" && hasReadableCertNumber(prior.card.cert)
        );
      const marketResult = await enrichExtractedCard({
        specimenId: id,
        card: catalogResult.card,
        phase: "market",
        ...catalogCtx,
        skipRegistry,
        skipCache: true,
      });
      setSpecimens((current) =>
        current.map((s) =>
          s.id === id
            ? {
                ...s,
                card: marketResult.card,
                context: {
                  ...marketResult.context,
                  ...catalogCtx,
                  catalogId: catalogCtx.catalogId ?? marketResult.context.catalogId,
                  catalogImageUrl:
                    catalogCtx.catalogImageUrl ?? marketResult.context.catalogImageUrl,
                },
              }
            : s,
        ),
      );
    } catch {
      // Keep the precision-improved extraction if re-enrich fails.
    }
  }, [enriching]);

  const runBackgroundPrecisionCrop = useCallback(
    async (candidates: ScanSpecimen[]) => {
      if (candidates.length === 0) return;
      const runId = ++precisionRunRef.current;
      let done = 0;
      const total = candidates.length;
      const concurrency = getLiquidScanSpeedProfile(speedOnRef.current)
        .precisionConcurrency;

      for (let offset = 0; offset < candidates.length; offset += concurrency) {
        if (precisionRunRef.current !== runId) return;
        const chunk = candidates.slice(offset, offset + concurrency);
        await Promise.all(
          chunk.map(async (item) => {
            try {
              if (!item.previewUrl) return;
              const extractedCrop = await runVisionOnSingleCardCrop(
                item.previewUrl,
                getEffectiveEvidenceCenter(item),
                {
                  gradedSlab: item.context.lane === "graded",
                  radiusMultiplier: getEffectiveEvidenceRadiusMultiplier(item),
                  timeoutMs: 90_000,
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
              if (!precisionCropImproves(item.card, merged)) return;

              const lane = classifyCardLane(merged);
              const card = extractedCardSchema.parse({
                ...merged,
                sourceImageIndex:
                  item.card.sourceImageIndex ?? merged.sourceImageIndex,
                visionLane: lane.lane,
                visionLaneConfidence: lane.confidence,
              });
              setSpecimens((current) =>
                current.map((entry) =>
                  entry.id === item.id ? { ...entry, card } : entry,
                ),
              );
              void reEnrichAfterPrecision(item.id, card);
            } catch {
              // Keep full-page extraction when the crop pass does not help.
            } finally {
              done += 1;
              if (precisionRunRef.current === runId) {
                setProgress(`Refining weak cards ${done}/${total}…`);
              }
            }
          }),
        );
      }

      if (precisionRunRef.current === runId) {
        setProgress((prev) =>
          prev?.startsWith("Refining weak") ? null : prev,
        );
      }
    },
    [reEnrichAfterPrecision],
  );

  const runScan = useCallback(async () => {
    if (scanLockRef.current || marketEnrichingRef.current) return;
    if (slots.length === 0) {
      setError("Add at least one image before scanning.");
      return;
    }
    scanLockRef.current = true;
    precisionRunRef.current += 1;
    setScanning(true);
    setEnriching(false);
    cancelPendingEnrich();
    setError(null);
    setScanLimit(null);
    setSpecimens([]);
    setSelectedId(null);
    const mode = scanModeRef.current;
    const binderGridScan = scanModeUsesBinderGrid(mode, slots.length, laneMode);
    const singleCardCrop = scanModeUsesSingleCardCrop(mode, slots.length, laneMode);
    const requestVisionVerify = scanModeRequestsVisionVerify(mode);
    setProgress(
      binderGridScan
        ? "Running vision on binder page…"
        : "Running vision extraction…",
    );
    try {
      const images = slots.map((slot) => slot.previewUrl);
      const captureAspects = new Map<number, number>();
      await Promise.all(
        images.map(async (url, index) => {
          if (!url) return;
          try {
            const { width, height } = await readImageNaturalSize(url);
            captureAspects.set(index, width / Math.max(1, height));
          } catch {
            // Aspect fallback uses card-count heuristics only.
          }
        }),
      );
      const specimensByImage = new Map<number, ScanSpecimen[]>();
      let visionCardCount = 0;

      const speedProfile = getLiquidScanSpeedProfile(speedOnRef.current);
      const binderGrid = binderGridScan;
      const extracted = await runVisionExtraction(images, {
        timeoutMs: getVisionClientTimeoutMs(),
        concurrency: speedProfile.visionConcurrency,
        binderGrid,
        singleCardCrop,
        gradedFocus: laneMode === "graded",
        visionVerify: requestVisionVerify,
        onProgress: (state) => {
          setProgress(
            `Vision ${state.imagesDone}/${state.imagesTotal} (${state.mode})`,
          );
        },
        onImageComplete: (cards, imageIndex) => {
          visionCardCount += cards.length;
          const batch = buildSpecimensFromVisionCards(cards, laneMode, slots, {
            captureAspects,
          });
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
      let nextSpecimens = buildSpecimensFromVisionCards(extracted, laneMode, slots, {
        captureAspects,
      });
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

      // Vision finished — sheet can show extracted rows while catalog/market run.
      setScanning(false);
      setProgress("Extraction complete — matching catalog…");
      await enrichSpecimens(nextSpecimens);
      const precisionMax = precisionCropMaxForCardCount(
        nextSpecimens.length,
        speedProfile,
      );
      const precisionCandidates = selectPrecisionCropCandidates(
        specimensRef.current.length > 0 ? specimensRef.current : nextSpecimens,
        {
          enabled: speedProfile.precisionCropEnabled,
          max: precisionMax,
        },
      );
      if (precisionCandidates.length > 0) {
        void runBackgroundPrecisionCrop(precisionCandidates);
      }
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
      scanLockRef.current = false;
      setScanning(false);
      void drainUploadQueue();
    }
  }, [
    cancelPendingEnrich,
    drainUploadQueue,
    enrichSpecimens,
    laneMode,
    runBackgroundPrecisionCrop,
    slots,
  ]);

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
          bbox: normalizeVisionBboxGrid(item.card.bbox),
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

        const lockedCatalogId = hasUserCatalogOverride(item.context)
          ? item.context.catalogId
          : null;
        const lockedCandidate =
          lockedCatalogId != null
            ? item.context.catalogCandidates.find((c) => c.catalogId === lockedCatalogId) ??
              (lockedCatalogId
                ? {
                    catalogId: lockedCatalogId,
                    name: item.card.name,
                    setName: item.card.set ?? null,
                    cardNumber: item.card.number ?? null,
                    year: item.card.year ?? null,
                    rarity: item.card.rarity ?? null,
                    score: 100,
                    confidence: 1,
                    reasons: ["Your catalog selection"],
                    conflicts: [],
                    imageSmallUrl: item.context.catalogImageUrl ?? null,
                    imageLargeUrl: null,
                  } satisfies CatalogCandidate
                : null)
            : null;

        let cardForMarket = nextCard;
        let catalogContext: ScanCardContext;

        if (lockedCandidate) {
          cardForMarket = buildConfirmedCardFromCandidate(
            nextCard,
            lockedCandidate,
            item.context.lane,
          );
          catalogContext = buildContextForUserCatalogSelection(
            id,
            cardForMarket,
            lockedCandidate,
            buildScanCardContext({ specimenId: id, card: cardForMarket }),
          );
          patchRow(cardForMarket, catalogContext);
        } else {
          setProgress("Matching catalog…");
          const catalogEnriched = await enrichExtractedCard({
            specimenId: id,
            card: nextCard,
            phase: "catalog",
            skipCache: true,
          });
          if (stale()) return;
          cardForMarket = catalogEnriched.card;
          catalogContext = catalogEnriched.context;
          patchRow(cardForMarket, catalogContext);
        }

        setProgress("Loading market data…");
        const enriched = await enrichExtractedCard({
          specimenId: id,
          card: cardForMarket,
          phase: "market",
          ...pickCatalogContext(catalogContext),
          skipCache: true,
        });
        if (stale()) return;
        patchRow(enriched.card, {
          ...enriched.context,
          ...pickCatalogContext(catalogContext),
          catalogId: catalogContext.catalogId ?? enriched.context.catalogId,
          catalogImageUrl: catalogContext.catalogImageUrl ?? enriched.context.catalogImageUrl,
        });
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
      const userLocked = hasUserCatalogOverride(item.context);
      let cardForMarket = item.card;
      let catalogSnapshot = pickCatalogContext(item.context);

      if (!userLocked) {
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
        cardForMarket = catalogResult.card;
        catalogSnapshot = pickCatalogContext(catalogResult.context);
      }

      const marketResult = await enrichExtractedCard({
        specimenId: id,
        card: cardForMarket,
        phase: "market",
        ...catalogSnapshot,
        skipCache: true,
        skipRegistry: false,
      });
      if (enrichRunRef.current.get(id) !== runId) return;

      setSpecimens((current) =>
        current.map((s) =>
          s.id === id
            ? {
                ...s,
                card: marketResult.card,
                context: {
                  ...marketResult.context,
                  ...catalogSnapshot,
                  catalogId: catalogSnapshot.catalogId ?? marketResult.context.catalogId,
                  catalogImageUrl:
                    catalogSnapshot.catalogImageUrl ?? marketResult.context.catalogImageUrl,
                },
              }
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
      if (enriching) return;
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
    [enriching, runManualEnrich],
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
      const clearsCatalogLock =
        patchTouchesManualIdentity(patch) &&
        specimensRef.current.some(
          (item) => item.id === id && hasUserCatalogOverride(item.context),
        );

      setSpecimens((current) =>
        current.map((item) => {
          if (item.id !== id) return item;
          let card = extractedCardSchema.parse({ ...item.card, ...patch });
          card = normalizeGradedSlabFields(card, item.context.lane);
          const catalogSnapshot = clearsCatalogLock
            ? {
                catalogId: null as string | null,
                catalogIdentityStatus: "ambiguous" as const,
                catalogConfidence: 0,
                catalogImageUrl: null as string | null,
              }
            : pickCatalogContext(item.context);
          return {
            ...item,
            card,
            context: buildScanCardContext({
              specimenId: id,
              card,
              ...catalogSnapshot,
              catalogCandidates: item.context.catalogCandidates,
              identityEvidence: clearsCatalogLock ? [] : item.context.identityEvidence,
              year: card.year ?? item.context.year,
              marketEvidence: item.context.marketEvidence,
              marketSourceLinks: item.context.marketSourceLinks,
              fairValueUsd: item.context.fairValueUsd,
              fairValueBasis: item.context.fairValueBasis,
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
          ...pickCatalogContext(
            specimensRef.current.find((item) => item.id === id)?.context ?? buildScanCardContext({ specimenId: id, card }),
          ),
          catalogId,
          catalogImageUrl,
          catalogIdentityStatus: "confirmed",
          catalogConfidence: 1,
          skipCache: true,
        });
        if (enrichRunRef.current.get(id) !== runId) return;

        setSpecimens((current) =>
          current.map((item) =>
            item.id === id
              ? {
                  ...item,
                  card: marketResult.card,
                  context: {
                    ...marketResult.context,
                    catalogId,
                    catalogIdentityStatus: "confirmed" as const,
                    catalogConfidence: 1,
                    catalogCandidates: item.context.catalogCandidates,
                    catalogImageUrl: catalogImageUrl ?? marketResult.context.catalogImageUrl,
                  },
                }
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

  const refreshCatalogCandidates = useCallback(async (id: string) => {
    const item = specimensRef.current.find((entry) => entry.id === id);
    if (!item || !hasMinimumIdentityForCatalog(item.card)) return;

    setCatalogRefreshingId(id);
    try {
      const result = await fetchCatalogCandidates({
        card: item.card,
        existingCandidates: item.context.catalogCandidates,
      });
      const manualLock = hasUserCatalogOverride(item.context);

      setSpecimens((current) =>
        current.map((entry) => {
          if (entry.id !== id) return entry;
          return {
            ...entry,
            context: buildScanCardContext({
              specimenId: id,
              card: entry.card,
              catalogId: manualLock ? entry.context.catalogId : result.catalogId,
              catalogIdentityStatus: manualLock
                ? entry.context.catalogIdentityStatus
                : result.catalogIdentityStatus,
              catalogConfidence: manualLock
                ? entry.context.catalogConfidence
                : result.catalogConfidence,
              catalogCandidates: result.candidates,
              identityEvidence:
                result.identityEvidence.length > 0
                  ? result.identityEvidence
                  : entry.context.identityEvidence,
              catalogImageUrl: manualLock
                ? entry.context.catalogImageUrl
                : result.catalogImageUrl ?? entry.context.catalogImageUrl,
              catalogImageSource: manualLock
                ? entry.context.catalogImageSource
                : result.catalogImageSource ?? entry.context.catalogImageSource,
              catalogImageSourceLabel: manualLock
                ? entry.context.catalogImageSourceLabel
                : result.catalogImageSourceLabel ?? entry.context.catalogImageSourceLabel,
              catalogImageNeedsReview: manualLock
                ? entry.context.catalogImageNeedsReview
                : result.catalogImageNeedsReview ?? entry.context.catalogImageNeedsReview,
              marketEvidence: entry.context.marketEvidence,
              marketSourceLinks: entry.context.marketSourceLinks,
              fairValueUsd: entry.context.fairValueUsd,
              fairValueBasis: entry.context.fairValueBasis,
              year: entry.card.year ?? entry.context.year,
            }),
          };
        }),
      );
    } catch {
      // Keep current candidates if refresh fails.
    } finally {
      setCatalogRefreshingId((current) => (current === id ? null : current));
    }
  }, []);

  const confirmCatalogCandidate = useCallback(
    (id: string, candidate: CatalogCandidate) => {
      const currentItem = specimensRef.current.find((item) => item.id === id);
      if (!currentItem) return;
      const confirmedCard = buildConfirmedCardFromCandidate(
        currentItem.card,
        candidate,
        currentItem.context.lane,
      );
      const catalogImageUrl = candidate.imageSmallUrl ?? candidate.imageLargeUrl ?? null;

      setSpecimens((current) =>
        current.map((item) => {
          if (item.id !== id) return item;
          return {
            ...item,
            card: confirmedCard,
            context: buildContextForUserCatalogSelection(
              id,
              confirmedCard,
              candidate,
              item.context,
            ),
          };
        }),
      );

      void refreshMarketForCatalogOverride(id, confirmedCard, candidate.catalogId, catalogImageUrl);
      void recordScanObservation({
        eventType: "user_confirm",
        specimenId: id,
        card: confirmedCard,
        context: currentItem.context,
        catalogId: candidate.catalogId,
      });
      if (userId) {
        void trackCompanionQuest(userId, "catalog_confirm", 1);
      }
    },
    [refreshMarketForCatalogOverride, userId],
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
        const nextPreviewUrl = rejectingActive
          ? (nextBest?.imageSmallUrl ?? nextBest?.imageLargeUrl ?? null)
          : (item.context.catalogImageUrl ?? null);

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
            catalogImageUrl: nextPreviewUrl,
          }),
        };
      }),
    );
    const currentItem = specimensRef.current.find((item) => item.id === id);
    if (currentItem) {
      void recordScanObservation({
        eventType: "user_reject",
        specimenId: id,
        card: currentItem.card,
        context: currentItem.context,
        catalogId,
      });
    }
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

  const hydrateSavedSession = useCallback(
    (items: Array<{ card: ExtractedCard; context: ScanCardContext }>) => {
      cancelPendingEnrich();
      setSlots([]);
      setError(null);
      setProgress(null);
      setScanLimit(null);
      setEnriching(false);
      setEnrichingSpecimenId(null);
      setRescanningId(null);

      const next: ScanSpecimen[] = items.map((item) => {
        const specimenId = makeId("specimen");
        const evidenceCropLocation =
          normalizeVisionGridLocation(item.card.location) ?? null;
        return {
          id: specimenId,
          card: item.card,
          context: { ...item.context, specimenId },
          previewUrl: null,
          evidenceCropLocation,
          userEvidenceCropCenter: null,
          userEvidenceCropRadiusMultiplier: null,
        };
      });

      setSpecimens(next);
      setSelectedId(next[0]?.id ?? null);
    },
    [cancelPendingEnrich],
  );

  const ingestCatalogPrefill = useCallback(
    async (prefill: CatalogScanPrefill): Promise<ScanSpecimen[]> => {
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
          ...pickCatalogContext(row.context),
          catalogId: prefill.catalogId,
          catalogImageUrl: row.context.catalogImageUrl,
          skipCache: true,
        });

        row = {
          ...row,
          card: marketResult.card,
          context: {
            ...marketResult.context,
            ...pickCatalogContext(row.context),
            catalogId: prefill.catalogId,
            catalogIdentityStatus: "confirmed",
            catalogImageUrl: row.context.catalogImageUrl,
          },
        };
        setSpecimens([row]);
        setProgress(null);
        return [row];
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load card from catalog",
        );
        setProgress(null);
        return [];
      } finally {
        setEnriching(false);
        setEnrichingSpecimenId(null);
      }
    },
    [],
  );

  const ingestLiveCameraScan = useCallback((result: LiveScanResult, file: File) => {
    const slotId = makeId("slot");
    setSlots((current) => [
      ...current,
      { id: slotId, file, previewUrl: result.previewUrl },
    ]);
    setSpecimens((current) => [...current, result.specimen]);
    setSelectedId(result.specimen.id);
    setError(null);
  }, []);

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
    marketEnriching,
    rescanningId,
    enrichingSpecimenId,
    catalogRefreshingId,
    error,
    scanLimit,
    clearScanLimit: () => setScanLimit(null),
    progress,
    totals,
    uploadQueuedCount,
    addFiles,
    removeSlot,
    reorderSlots,
    ingestCertMatrix,
    runScan,
    updateSpecimen,
    confirmCatalogCandidate,
    rejectCatalogCandidate,
    refreshCatalogCandidates,
    flushManualEnrich,
    rescanSpecimen,
    setUserEvidenceCrop,
    removeSpecimen,
    clearSession,
    hydrateSavedSession,
    ingestCatalogPrefill,
    ingestLiveCameraScan,
  };
}
