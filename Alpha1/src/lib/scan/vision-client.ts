import { readResponseJson } from "@/lib/http/read-response-json";
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
export function readImageFileAsDataUrl(file: File): Promise<string> {
  return prepareScanUploadDataUrl(file);
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

export async function runVisionExtraction(
  images: string[],
  options: {
    timeoutMs?: number;
    /** Tight crop already isolates one card — use focused prompt and expect one result. */
    singleCardCrop?: boolean;
    /** Graded Card Mode — slab tag OCR priority (PSA/CGC/BGS). */
    gradedFocus?: boolean;
    /** Parallel vision requests (default 3). Set 1 for strictly sequential. */
    concurrency?: number;
    onProgress?: (progress: VisionProgress) => void;
    /** Fires after each image finishes — use to show extracted rows before the full batch completes. */
    onImageComplete?: (cards: unknown[], imageIndex: number) => void;
  } = {},
): Promise<unknown[]> {
  const timeoutMs = options.timeoutMs ?? getVisionClientTimeoutMs();
  if (images.length === 0) return [];

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

      const cards = await extractVisionForImage(images[imageIndex], imageIndex, {
        timeoutMs,
        singleCardCrop: options.singleCardCrop,
        gradedFocus: options.gradedFocus,
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
    concurrency: 1,
  });
}
