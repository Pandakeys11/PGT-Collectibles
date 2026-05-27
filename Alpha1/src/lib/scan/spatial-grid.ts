import type { VisionGridLocation } from "@/lib/scan/spatial";
import type { VisionCropRectFloat } from "@/lib/scan/specimen-crop";
import { CARD_EVIDENCE_VISION_RADIUS_MULTIPLIER } from "@/lib/scan/specimen-crop";

/** Vision models may return 0–1, 0–100, or 0–1000 — normalize to the 0–1000 grid. */
export function scaleVisionGridCoord(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const abs = Math.abs(value);
  if (abs <= 1.001) return Math.round(value * 1000);
  if (abs <= 100.001) return Math.round(value * 10);
  return Math.round(Math.max(0, Math.min(1000, value)));
}

export type VisionBboxGrid = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export function normalizeVisionBboxGrid(raw: unknown): VisionBboxGrid | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const box = raw as Record<string, unknown>;
  const top = scaleVisionGridCoord(Number(box.top));
  const left = scaleVisionGridCoord(Number(box.left));
  const width = scaleVisionGridCoord(Number(box.width));
  const height = scaleVisionGridCoord(Number(box.height));
  if (width < 8 || height < 8) return undefined;
  if (top + height > 1005 || left + width > 1005) return undefined;
  return {
    top: Math.max(0, Math.min(1000, top)),
    left: Math.max(0, Math.min(1000, left)),
    width: Math.max(8, Math.min(1000, width)),
    height: Math.max(8, Math.min(1000, height)),
  };
}

export function locationFromBboxGrid(bbox: VisionBboxGrid): VisionGridLocation {
  const y = Math.max(0, Math.min(1000, Math.round(bbox.top + bbox.height / 2)));
  const x = Math.max(0, Math.min(1000, Math.round(bbox.left + bbox.width / 2)));
  return [y, x] as const;
}

/** Crop rectangle in source pixels from a 0–1000 bbox (preferred over center+radius heuristics). */
export function bboxGridToCropRectFloat(
  naturalWidth: number,
  naturalHeight: number,
  bbox: VisionBboxGrid,
  opts?: { paddingRatio?: number; gradedSlab?: boolean },
): VisionCropRectFloat {
  const pad = opts?.paddingRatio ?? (opts?.gradedSlab ? 0.05 : 0.08);
  const topPx = (bbox.top / 1000) * naturalHeight;
  const leftPx = (bbox.left / 1000) * naturalWidth;
  const hPx = (bbox.height / 1000) * naturalHeight;
  const wPx = (bbox.width / 1000) * naturalWidth;
  const padY = hPx * pad;
  const padX = wPx * pad;
  let sy = topPx - padY;
  let sx = leftPx - padX;
  let sh = hPx + padY * 2;
  let sw = wPx + padX * 2;
  const minH = opts?.gradedSlab ? 48 : 32;
  const minW = opts?.gradedSlab ? 36 : 32;
  sh = Math.max(minH, sh);
  sw = Math.max(minW, sw);
  sx = Math.max(0, Math.min(sx, naturalWidth - sw));
  sy = Math.max(0, Math.min(sy, naturalHeight - sh));
  if (sx + sw > naturalWidth) sw = naturalWidth - sx;
  if (sy + sh > naturalHeight) sh = naturalHeight - sy;
  return { sx, sy, sw, sh };
}

/** Match center+radius UI to a vision bbox for the adjust-crop dialog initial frame. */
export function radiusMultiplierFromBboxGrid(
  bbox: VisionBboxGrid,
  gradedSlab?: boolean,
): number {
  const span = gradedSlab
    ? Math.max(bbox.height, bbox.width * 0.55)
    : Math.max(bbox.width, bbox.height);
  const target = gradedSlab ? 740 : 440;
  const mult = span / target;
  return Math.max(0.55, Math.min(1.35, mult * CARD_EVIDENCE_VISION_RADIUS_MULTIPLIER));
}

export function evidenceFrameFromVision(args: {
  location?: VisionGridLocation | null;
  bbox?: VisionBboxGrid | null;
  gradedSlab?: boolean;
}): { center: VisionGridLocation; radiusMultiplier: number } {
  if (args.bbox) {
    return {
      center: locationFromBboxGrid(args.bbox),
      radiusMultiplier: radiusMultiplierFromBboxGrid(args.bbox, args.gradedSlab),
    };
  }
  return {
    center: args.location ?? ([500, 500] as const),
    radiusMultiplier: CARD_EVIDENCE_VISION_RADIUS_MULTIPLIER,
  };
}
