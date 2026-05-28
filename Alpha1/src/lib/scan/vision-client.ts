import { readResponseJson } from "@/lib/http/read-response-json";
import {
  dedupeBinderGridVisionCards,
  mapTileLocationToParent,
  planBinderGridTiles,
  readImageNaturalSize,
  renderBinderGridTileDataUrl,
  shouldTileBinderGridImage,
} from "@/lib/scan/binder-grid-vision";
import { ensureScanUploadDataUrl, prepareScanUploadDataUrl } from "@/lib/scan/prepare-upload-image";
import { parseScanLimitFromResponse } from "@/lib/scan/scan-limit-error";
import { CARD_EVIDENCE_VISION_RADIUS_MULTIPLIER, extractCardRegionDataUrl } from "@/lib/scan/specimen-crop";
import type { VisionGridLocation } from "@/lib/scan/spatial";

export const DEFAULT_VISION_CLIENT_TIMEOUT_MS = 300_000;
const DEFAULT_VISION_CONCURRENCY = 3;

export function getVisionClientTimeoutMs(): number {
  const raw =
    typeof process !== "undefined" ? process.env.NEXT_PUBLIC_VISION_CLIENT_TIMEOUT_MS?.trim() : undefined;
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 45_000) return Math.min(n, 300_000);
  }
  return DEFAULT_VISION_CLIENT_TIMEOUT_MS;
}

export function getVisionConcurrency(): number {
  const raw =
    typeof process !== "undefined" ? process.env.NEXT_PUBLIC_VISION_CONCURRENCY?.trim() : undefined;
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 1) return Math.min(Math.floor(n), 6);
  }
  return DEFAULT_VISION_CONCURRENCY;
}

/** Compress + orient photos before preview/vision (critical on mobile camera uploads). */
export function readImageFileAsDataUrl(
  file: File,
  options?: { binderGrid?: boolean; singleCard?: boolean },
): Promise<string> {
  return prepareScanUploadDataUrl(file, options);
}

function dataUrlToBase64(dataUrl: string): string {
  const comma = dataUrl.indexOf(",");
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

function dataUrlMimeType(dataUrl: string): string {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);
  return match?.[1] || "image/jpeg";
}

export type VisionProgress = {
  imagesDone: number;
  imagesTotal: number;
  mode: "perPage" | "parallel";
};

async function extractVisionForImage(
  imageDataUrl: string,
  imageIndex: number,
  options: {
    timeoutMs: number;
    singleCardCrop?: boolean;
    gradedFocus?: boolean;
    binderGrid?: boolean;
    visionVerify?: boolean;
  },
): Promise<unknown[]> {
  const signal = AbortSignal.timeout(options.timeoutMs);
  const prepared = await ensureScanUploadDataUrl(imageDataUrl);
  const res = await fetch("/api/vision/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imageBase64s: [dataUrlToBase64(prepared)],
      imageMimeTypes: [dataUrlMimeType(prepared)],
      singleCardCrop: options.singleCardCrop ?? false,
      gradedFocus: options.gradedFocus === true ? true : undefined,
      binderGrid: options.binderGrid === true ? true : undefined,
      visionVerify: options.visionVerify === true ? true : undefined,
    }),
    signal,
  });
  const data = await readResponseJson<{
    cards?: unknown[];
    error?: string;
    reason?: string;
    usage?: Record<string, unknown>;
  }>(res);
  if (!res.ok) {
    const limitErr = parseScanLimitFromResponse(res.status, data);
    if (limitErr) throw limitErr;
    if (res.status === 413) {
      throw new Error(
        data.error ||
          "Photo is too large to upload — try one image at a time or move closer so the file is smaller.",
      );
    }
    throw new Error(
      data.error ||
        (res.status === 500 && !data.error
          ? "Vision scan failed — sign in again or restart the dev server if this persists"
          : `Vision scan failed (${res.status})`),
    );
  }
  if (!Array.isArray(data.cards)) return [];
  return data.cards.map((card) => ({
    ...(card as object),
    sourceImageIndex: imageIndex,
    visionBatchMerged: false,
  }));
}

function remapTileCardToParent(
  raw: unknown,
  tile: import("@/lib/scan/binder-grid-vision").BinderGridTile,
  imageIndex: number,
): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const card = { ...(raw as Record<string, unknown>) };
  const loc = card.location;
  if (Array.isArray(loc) && loc.length >= 2) {
    const y = Number(loc[0]);
    const x = Number(loc[1]);
    if (Number.isFinite(y) && Number.isFinite(x)) {
      card.location = mapTileLocationToParent([y, x], tile);
    }
  }
  const bbox = card.bbox;
  if (bbox && typeof bbox === "object") {
    const box = bbox as Record<string, unknown>;
    const top = Number(box.top);
    const left = Number(box.left);
    const bw = Number(box.width);
    const bh = Number(box.height);
    if ([top, left, bw, bh].every(Number.isFinite)) {
      card.location = mapTileLocationToParent([top + bh / 2, left + bw / 2], tile);
    }
  }
  return {
    ...card,
    sourceImageIndex: imageIndex,
    visionBatchMerged: false,
  };
}

/** Tiled vision for dense binder screenshots — one scan credit, server runs per-tile OCR. */
async function extractVisionForBinderGridImage(
  imageDataUrl: string,
  imageIndex: number,
  options: {
    timeoutMs: number;
    gradedFocus?: boolean;
    visionVerify?: boolean;
  },
): Promise<unknown[]> {
  const prepared = await ensureScanUploadDataUrl(imageDataUrl);
  const { width, height } = await readImageNaturalSize(prepared);

  if (!shouldTileBinderGridImage(width, height)) {
    return extractVisionForImage(prepared, imageIndex, {
      timeoutMs: options.timeoutMs,
      gradedFocus: options.gradedFocus,
      binderGrid: true,
      visionVerify: options.visionVerify,
    });
  }

  const plan = planBinderGridTiles(width, height);
  const rendered: Array<{
    tile: import("@/lib/scan/binder-grid-vision").BinderGridTile;
    dataUrl: string;
  }> = [];

  for (const tile of plan.tiles) {
    const tileDataUrl = await renderBinderGridTileDataUrl(prepared, tile, 2048);
    if (tileDataUrl) rendered.push({ tile, dataUrl: tileDataUrl });
  }

  if (rendered.length === 0) {
    return extractVisionForImage(prepared, imageIndex, {
      timeoutMs: options.timeoutMs,
      gradedFocus: options.gradedFocus,
      binderGrid: true,
      visionVerify: options.visionVerify,
    });
  }

  const signal = AbortSignal.timeout(options.timeoutMs);
  const preparedTiles = await Promise.all(
    rendered.map((entry) => ensureScanUploadDataUrl(entry.dataUrl)),
  );
  const res = await fetch("/api/vision/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imageBase64s: preparedTiles.map(dataUrlToBase64),
      imageMimeTypes: preparedTiles.map(dataUrlMimeType),
      binderGrid: true,
      scanCreditCount: 1,
    }),
    signal,
  });
  const data = await readResponseJson<{ cards?: unknown[]; error?: string }>(res);
  if (!res.ok) {
    throw new Error(data.error ?? `Vision scan failed (${res.status})`);
  }
  if (!Array.isArray(data.cards) || data.cards.length === 0) {
    return extractVisionForImage(prepared, imageIndex, {
      timeoutMs: options.timeoutMs,
      gradedFocus: options.gradedFocus,
      binderGrid: true,
      visionVerify: options.visionVerify,
    });
  }

  const merged: Record<string, unknown>[] = [];
  for (const raw of data.cards) {
    const tileIndex =
      raw && typeof raw === "object"
        ? Number((raw as Record<string, unknown>).sourceTileIndex)
        : NaN;
    const tile =
      Number.isFinite(tileIndex) && tileIndex >= 0 && tileIndex < rendered.length
        ? rendered[tileIndex]!.tile
        : rendered[0]!.tile;
    const mapped = remapTileCardToParent(raw, tile, imageIndex);
    if (mapped) merged.push(mapped);
  }

  return dedupeBinderGridVisionCards(merged, width / height);
}

export async function runVisionExtraction(
  images: string[],
  options: {
    timeoutMs?: number;
    /** Tight crop already isolates one card — use focused prompt and expect one result. */
    singleCardCrop?: boolean;
    /** Graded Card Mode — slab tag OCR priority (PSA/CGC/BGS). */
    gradedFocus?: boolean;
    /** Multi-card binder / grid screenshot — tiled vision + binder prompts. */
    binderGrid?: boolean;
    /** Optional second pass using Gemini to verify/fix single-image extraction. */
    visionVerify?: boolean;
    /** Parallel vision requests (default 3). Set 1 for strictly sequential. */
    concurrency?: number;
    onProgress?: (progress: VisionProgress) => void;
    /** Fires after each image finishes — use to show extracted rows before the full batch completes. */
    onImageComplete?: (cards: unknown[], imageIndex: number) => void;
  } = {},
): Promise<unknown[]> {
  const timeoutMs = options.timeoutMs ?? getVisionClientTimeoutMs();
  if (images.length === 0) return [];
  const visionVerify = options.visionVerify === true;

  const concurrency = Math.min(
    options.concurrency ?? getVisionConcurrency(),
    images.length,
  );
  const mode: VisionProgress["mode"] = concurrency > 1 ? "parallel" : "perPage";
  const results: unknown[][] = new Array(images.length);
  let nextIndex = 0;
  let imagesDone = 0;

  options.onProgress?.({ imagesDone: 0, imagesTotal: images.length, mode });

  async function worker() {
    while (true) {
      const imageIndex = nextIndex;
      nextIndex += 1;
      if (imageIndex >= images.length) break;

      const useBinderTiles =
        options.binderGrid === true &&
        !options.singleCardCrop &&
        images.length === 1;
      const cards = useBinderTiles
        ? await extractVisionForBinderGridImage(images[imageIndex], imageIndex, {
            timeoutMs,
            gradedFocus: options.gradedFocus,
            visionVerify,
          })
        : await extractVisionForImage(images[imageIndex], imageIndex, {
            timeoutMs,
            singleCardCrop: options.singleCardCrop,
            gradedFocus: options.gradedFocus,
            binderGrid: options.binderGrid,
            visionVerify,
          });
      results[imageIndex] = cards;
      imagesDone += 1;
      options.onProgress?.({ imagesDone, imagesTotal: images.length, mode });
      options.onImageComplete?.(cards, imageIndex);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results.flat();
}

/** Run vision on a tight crop of one card from a full-page capture (single-row resync). */
export async function runVisionOnSingleCardCrop(
  fullPageDataUrl: string,
  center: VisionGridLocation,
  options: {
    gradedSlab?: boolean;
    radiusMultiplier?: number;
    timeoutMs?: number;
  } = {},
): Promise<unknown[]> {
  const crop = await extractCardRegionDataUrl(fullPageDataUrl, center, {
    gradedSlab: options.gradedSlab,
    radiusMultiplier: options.radiusMultiplier ?? CARD_EVIDENCE_VISION_RADIUS_MULTIPLIER,
    maxOutputSide: 2560,
    quality: 0.96,
  });
  if (!crop) return [];
  return runVisionExtraction([crop], {
    timeoutMs: options.timeoutMs ?? getVisionClientTimeoutMs(),
    singleCardCrop: true,
    gradedFocus: options.gradedSlab === true,
    visionVerify: false,
    concurrency: 1,
  });
}
