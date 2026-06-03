import type { ScanLaneMode } from "@/lib/scan/build-specimens";
import {
  type LiveGuideLayout,
  guideAspectForLane,
  guideRectToVideoCrop,
} from "@/lib/scan/live-camera-frame";

export type FrameQualityHint =
  | "too-dark"
  | "glare"
  | "move-closer"
  | "move-back"
  | "off-center";

export type DetectedCardBounds = {
  /** Normalized 0–1 inside the base guide rect. */
  left: number;
  top: number;
  right: number;
  bottom: number;
  confidence: number;
};

export type LiveFrameAnalysis = {
  hints: FrameQualityHint[];
  detected: DetectedCardBounds | null;
  /** Guide snapped to detected card when confidence is high enough. */
  activeGuide: LiveGuideLayout;
};

const ANALYSIS_W = 96;

function luma(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function sampleGuideRegion(
  video: HTMLVideoElement,
  container: { width: number; height: number },
  guide: LiveGuideLayout,
): ImageData | null {
  try {
    const crop = guideRectToVideoCrop(video, container, guide);
    const canvas = document.createElement("canvas");
    canvas.width = ANALYSIS_W;
    canvas.height = Math.max(8, Math.round(ANALYSIS_W / (guide.width / guide.height)));
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(video, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, canvas.width, canvas.height);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  } catch {
    return null;
  }
}

function grayscale(data: ImageData): Float32Array {
  const out = new Float32Array(data.width * data.height);
  for (let i = 0, p = 0; i < data.data.length; i += 4, p += 1) {
    out[p] = luma(data.data[i]!, data.data[i + 1]!, data.data[i + 2]!);
  }
  return out;
}

function sobelMagnitude(gray: Float32Array, w: number, h: number): Float32Array {
  const mag = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const idx = y * w + x;
      const gx =
        -gray[idx - w - 1]! +
        gray[idx - w + 1]! -
        2 * gray[idx - 1]! +
        2 * gray[idx + 1]! -
        gray[idx + w - 1]! +
        gray[idx + w + 1]!;
      const gy =
        -gray[idx - w - 1]! -
        2 * gray[idx - w]! -
        gray[idx - w + 1]! +
        gray[idx + w - 1]! +
        2 * gray[idx + w]! +
        gray[idx + w + 1]!;
      mag[idx] = Math.hypot(gx, gy);
    }
  }
  return mag;
}

function columnEdgeScore(mag: Float32Array, w: number, h: number, col: number): number {
  let sum = 0;
  const y0 = Math.floor(h * 0.12);
  const y1 = Math.floor(h * 0.88);
  for (let y = y0; y < y1; y += 1) sum += mag[y * w + col]!;
  return sum / Math.max(1, y1 - y0);
}

function rowEdgeScore(mag: Float32Array, w: number, h: number, row: number): number {
  let sum = 0;
  const x0 = Math.floor(w * 0.12);
  const x1 = Math.floor(w * 0.88);
  for (let x = x0; x < x1; x += 1) sum += mag[row * w + x]!;
  return sum / Math.max(1, x1 - x0);
}

function findEdgePeak(scores: number[], from: number, to: number, step: number): number | null {
  const start = step > 0 ? from : to;
  const end = step > 0 ? to : from;
  let bestIdx = start;
  let best = -1;
  for (let i = start; step > 0 ? i < end : i > end; i += step) {
    const s = scores[i]!;
    if (s > best) {
      best = s;
      bestIdx = i;
    }
  }
  const avg =
    scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length);
  if (best < avg * 1.35) return null;
  return bestIdx / Math.max(1, scores.length - 1);
}

function detectCardBounds(gray: Float32Array, w: number, h: number): DetectedCardBounds | null {
  const mag = sobelMagnitude(gray, w, h);
  const colScores = Array.from({ length: w }, (_, x) => columnEdgeScore(mag, w, h, x));
  const rowScores = Array.from({ length: h }, (_, y) => rowEdgeScore(mag, w, h, y));

  const left = findEdgePeak(colScores, 2, Math.floor(w * 0.45), 1);
  const right = findEdgePeak(colScores, w - 3, Math.floor(w * 0.55), -1);
  const top = findEdgePeak(rowScores, 2, Math.floor(h * 0.45), 1);
  const bottom = findEdgePeak(rowScores, h - 3, Math.floor(h * 0.55), -1);

  if (left == null || right == null || top == null || bottom == null) return null;
  if (right - left < 0.28 || bottom - top < 0.28) return null;
  if (right - left > 0.98 && bottom - top > 0.98) return null;

  const fill = (right - left) * (bottom - top);
  const confidence = Math.min(1, fill * 1.15 + 0.15);

  return { left, top, right, bottom, confidence };
}

function qualityHints(gray: Float32Array, w: number, h: number, detected: DetectedCardBounds | null): FrameQualityHint[] {
  const hints: FrameQualityHint[] = [];
  let sum = 0;
  let glare = 0;
  let sumSq = 0;
  for (let i = 0; i < gray.length; i += 1) {
    const v = gray[i]!;
    sum += v;
    sumSq += v * v;
    if (v > 248) glare += 1;
  }
  const avg = sum / gray.length;
  const variance = sumSq / gray.length - avg * avg;

  if (avg < 42) hints.push("too-dark");
  if (glare / gray.length > 0.045) hints.push("glare");
  if (variance < 180) hints.push("move-closer");

  if (detected) {
    const fill = (detected.right - detected.left) * (detected.bottom - detected.top);
    if (fill < 0.42) hints.push("move-closer");
    if (fill > 0.94) hints.push("move-back");
    const cx = (detected.left + detected.right) / 2;
    const cy = (detected.top + detected.bottom) / 2;
    if (Math.abs(cx - 0.5) > 0.12 || Math.abs(cy - 0.5) > 0.12) hints.push("off-center");
  }

  return hints;
}

export function applyDetectedBoundsToGuide(
  base: LiveGuideLayout,
  detected: DetectedCardBounds,
  laneMode: ScanLaneMode,
): LiveGuideLayout {
  const aspect = guideAspectForLane(laneMode);
  const guideLeft = base.centerX - base.width / 2;
  const guideTop = base.centerY - base.height / 2;

  const detW = (detected.right - detected.left) * base.width;
  const detH = (detected.bottom - detected.top) * base.height;
  const detCx = guideLeft + ((detected.left + detected.right) / 2) * base.width;
  const detCy = guideTop + ((detected.top + detected.bottom) / 2) * base.height;

  let width = detW;
  let height = width / aspect;
  if (height > detH * 1.08) {
    height = detH;
    width = height * aspect;
  }

  const pad = 1.06;
  width = Math.min(base.width * 0.98, width * pad);
  height = width / aspect;

  return {
    width,
    height,
    centerX: detCx,
    centerY: detCy,
  };
}

export function hintLabel(hint: FrameQualityHint): string {
  switch (hint) {
    case "too-dark":
      return "Too dark — add light";
    case "glare":
      return "Glare detected — tilt 45°";
    case "move-closer":
      return "Move closer — fill frame";
    case "move-back":
      return "Move back slightly";
    case "off-center":
      return "Center card in frame";
    default:
      return "";
  }
}

export function analyzeLiveCameraFrame(
  video: HTMLVideoElement,
  container: { width: number; height: number },
  baseGuide: LiveGuideLayout,
  laneMode: ScanLaneMode,
): LiveFrameAnalysis | null {
  const data = sampleGuideRegion(video, container, baseGuide);
  if (!data) return null;

  const gray = grayscale(data);
  const detected = detectCardBounds(gray, data.width, data.height);
  const hints = qualityHints(gray, data.width, data.height, detected);

  const activeGuide =
    detected && detected.confidence >= 0.42
      ? applyDetectedBoundsToGuide(baseGuide, detected, laneMode)
      : baseGuide;

  return { hints, detected, activeGuide };
}
