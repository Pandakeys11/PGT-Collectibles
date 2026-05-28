import type { VisionGridLocation } from "@/lib/scan/spatial";
import {
  bboxGridToCropRectFloat,
  type VisionBboxGrid,
} from "@/lib/scan/spatial-grid";

export type VisionCropRectPx = { sx: number; sy: number; sw: number; sh: number };

/** Sub-pixel crop rect — avoids rounding parent grid when mapping crop vision back. */
export type VisionCropRectFloat = {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
};

/**
 * One knob for how large the card window is around the grid center (raw square + graded slab axes).
 * Used for evidence JPEGs, the adjust-crop dialog overlay, `extractCardRegionDataUrl` / resync vision,
 * and mapping a vision hit inside that crop back onto the full upload — all must match.
 * Lower = tighter on-card framing (legacy paths used ~1.38–1.45 and were often too loose vs the UI).
 */
export const CARD_EVIDENCE_VISION_RADIUS_MULTIPLIER = 0.88;

/** User-adjustable frame size range (multiplier on base card window). */
export const CROP_RADIUS_MULT_MIN = 0.55;
export const CROP_RADIUS_MULT_MAX = 1.4;
export const CROP_RADIUS_MULT_STEP = 0.02;

export function clampCropRadiusMultiplier(value: number): number {
  if (!Number.isFinite(value)) return CARD_EVIDENCE_VISION_RADIUS_MULTIPLIER;
  const step = CROP_RADIUS_MULT_STEP;
  const snapped = Math.round(value / step) * step;
  return Math.min(CROP_RADIUS_MULT_MAX, Math.max(CROP_RADIUS_MULT_MIN, snapped));
}

export type EvidenceCropAdjustment = {
  center: VisionGridLocation;
  radiusMultiplier: number;
};

/**
 * Maps vision grid center [y,x] on 0–1000 to a crop rect in source pixels.
 * Raw cards: square window. Graded slabs: taller portrait window (typical PSA/CGC aspect).
 */
export function visionLocationToCropRectFloat(
  naturalWidth: number,
  naturalHeight: number,
  location: VisionGridLocation,
  opts?: { gradedSlab?: boolean; radiusMultiplier?: number },
): VisionCropRectFloat {
  const [gyThousand, gxThousand] = location;
  const cx = (gxThousand / 1000) * naturalWidth;
  const cy = (gyThousand / 1000) * naturalHeight;
  const minDim = Math.min(naturalWidth, naturalHeight);
  const mult = opts?.radiusMultiplier ?? 1;

  if (opts?.gradedSlab) {
    let halfW = 0.19 * minDim * mult;
    let halfH = 0.4 * minDim * mult;
    halfW = Math.min(halfW, cx - 1, naturalWidth - cx - 1);
    halfH = Math.min(halfH, cy - 1, naturalHeight - cy - 1);
    halfW = Math.max(24, halfW);
    halfH = Math.max(40, halfH);
    const sw = Math.min(halfW * 2, naturalWidth);
    const sh = Math.min(halfH * 2, naturalHeight);
    let sx = cx - sw / 2;
    let sy = cy - sh / 2;
    sx = Math.max(0, Math.min(sx, naturalWidth - sw));
    sy = Math.max(0, Math.min(sy, naturalHeight - sh));
    return { sx, sy, sw, sh };
  }

  const normRadius = 0.2 * mult;
  let half = normRadius * minDim;
  half = Math.min(half, cx - 1, naturalWidth - cx - 1, cy - 1, naturalHeight - cy - 1);
  half = Math.max(28, half);
  const sw = Math.min(half * 2, naturalWidth);
  const sh = Math.min(half * 2, naturalHeight);
  let sx = cx - sw / 2;
  let sy = cy - sh / 2;
  sx = Math.max(0, Math.min(sx, naturalWidth - sw));
  sy = Math.max(0, Math.min(sy, naturalHeight - sh));
  return { sx, sy, sw, sh };
}

export function visionLocationToCropRectPx(
  naturalWidth: number,
  naturalHeight: number,
  location: VisionGridLocation,
  opts?: { gradedSlab?: boolean; /** Widen/narrow the raw-card crop (default 1). */ radiusMultiplier?: number },
): VisionCropRectPx {
  const rect = visionLocationToCropRectFloat(naturalWidth, naturalHeight, location, opts);
  const sw = Math.max(1, Math.round(rect.sw));
  const sh = Math.max(1, Math.round(rect.sh));
  let sx = Math.round(rect.sx);
  let sy = Math.round(rect.sy);
  sx = Math.max(0, Math.min(sx, naturalWidth - sw));
  sy = Math.max(0, Math.min(sy, naturalHeight - sh));
  return { sx, sy, sw, sh };
}

function loadImageElement(imageSrc: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = imageSrc;
  });
}

/**
 * Returns a data URL (JPEG) of the card region for crisp UI previews.
 */
function resolveCropRectPx(
  nw: number,
  nh: number,
  location: VisionGridLocation | undefined,
  options: {
    gradedSlab?: boolean;
    radiusMultiplier?: number;
    bbox?: VisionBboxGrid | null;
  },
): VisionCropRectPx {
  const gridBbox = options.bbox ?? null;
  if (gridBbox) {
    const rect = bboxGridToCropRectFloat(nw, nh, gridBbox, {
      gradedSlab: options.gradedSlab,
    });
    const sw = Math.max(1, Math.round(rect.sw));
    const sh = Math.max(1, Math.round(rect.sh));
    let sx = Math.round(rect.sx);
    let sy = Math.round(rect.sy);
    sx = Math.max(0, Math.min(sx, nw - sw));
    sy = Math.max(0, Math.min(sy, nh - sh));
    return { sx, sy, sw, sh };
  }
  const loc: VisionGridLocation = location ?? ([500, 500] as const);
  return visionLocationToCropRectPx(nw, nh, loc, {
    gradedSlab: options.gradedSlab,
    radiusMultiplier: options.radiusMultiplier ?? CARD_EVIDENCE_VISION_RADIUS_MULTIPLIER,
  });
}

export async function cropImageWithVisionLocation(
  imageSrc: string,
  location: VisionGridLocation | undefined,
  options: {
    gradedSlab?: boolean;
    maxOutputSide: number;
    quality?: number;
    radiusMultiplier?: number;
    bbox?: VisionBboxGrid | null;
  },
): Promise<string | null> {
  try {
    const img = await loadImageElement(imageSrc);
    const nw = img.naturalWidth || img.width;
    const nh = img.naturalHeight || img.height;
    if (nw < 2 || nh < 2) return null;

    const { sx, sy, sw, sh } = resolveCropRectPx(nw, nh, location, {
      gradedSlab: options.gradedSlab,
      radiusMultiplier: options.radiusMultiplier,
      bbox: options.bbox ?? null,
    });
    const cap = Math.max(64, options.maxOutputSide);
    const scale = Math.min(1, cap / Math.max(sw, sh));
    const outW = Math.max(1, Math.round(sw * scale));
    const outH = Math.max(1, Math.round(sh * scale));

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
    const q = options.quality ?? 0.93;
    return canvas.toDataURL("image/jpeg", q);
  } catch {
    return null;
  }
}

/** Natural pixel size of a loaded image src (data URL or http). */
export async function getNaturalImageSize(imageSrc: string): Promise<{ width: number; height: number }> {
  const img = await loadImageElement(imageSrc);
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;
  return { width, height };
}

/**
 * Map a vision [y,x] center from a **sub-crop** (same framing as `extractCardRegionDataUrl`) back to parent 0–1000.
 */
export function mapVisionLocationFromSubCropToParent(
  parentW: number,
  parentH: number,
  parentCropCenter: VisionGridLocation,
  childLoc: VisionGridLocation | undefined,
  opts?: { gradedSlab?: boolean; radiusMultiplier?: number },
): VisionGridLocation {
  const rect = visionLocationToCropRectFloat(parentW, parentH, parentCropCenter, opts);
  const [cy, cx] = childLoc ?? ([500, 500] as const);
  const px = rect.sx + (cx / 1000) * rect.sw;
  const py = rect.sy + (cy / 1000) * rect.sh;
  const gx = Math.round((px / parentW) * 1000);
  const gy = Math.round((py / parentH) * 1000);
  return [Math.max(0, Math.min(1000, gy)), Math.max(0, Math.min(1000, gx))] as const;
}

/**
 * Extract a JPEG data URL region around `location` for sending to vision (slightly wider than UI preview).
 */
export async function extractCardRegionDataUrl(
  imageSrc: string,
  location: VisionGridLocation,
  options: {
    gradedSlab?: boolean;
    radiusMultiplier?: number;
    maxOutputSide?: number;
    quality?: number;
    bbox?: VisionBboxGrid | null;
  } = {},
): Promise<string | null> {
  const mult = options.radiusMultiplier ?? CARD_EVIDENCE_VISION_RADIUS_MULTIPLIER;
  const maxSide = Math.max(256, options.maxOutputSide ?? 1400);
  const q = options.quality ?? 0.92;
  try {
    const img = await loadImageElement(imageSrc);
    const nw = img.naturalWidth || img.width;
    const nh = img.naturalHeight || img.height;
    if (nw < 2 || nh < 2) return null;

    const { sx, sy, sw, sh } = resolveCropRectPx(nw, nh, location, {
      gradedSlab: options.gradedSlab,
      radiusMultiplier: mult,
      bbox: options.bbox ?? null,
    });
    const scale = Math.min(1, maxSide / Math.max(sw, sh));
    const outW = Math.max(1, Math.round(sw * scale));
    const outH = Math.max(1, Math.round(sh * scale));

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
    return canvas.toDataURL("image/jpeg", q);
  } catch {
    return null;
  }
}
