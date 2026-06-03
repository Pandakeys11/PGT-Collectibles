import type { ScanLaneMode } from "@/lib/scan/build-specimens";
import {
  SCAN_UPLOAD_SINGLE_MAX_SIDE,
  ensureScanUploadDataUrl,
} from "@/lib/scan/prepare-upload-image";

/** Full-frame vision — same resolution budget as upload resync crops. */
export const LIVE_VISION_MAX_SIDE = 2560;

/** Tight evidence thumbnail from the guide window. */
export const LIVE_EVIDENCE_MAX_SIDE = SCAN_UPLOAD_SINGLE_MAX_SIDE;

export const LIVE_CAPTURE_JPEG_QUALITY = 0.94;

/** Standard Pokémon TCG card (2.5″ × 3.5″). */
export const TCG_CARD_ASPECT = 2.5 / 3.5;

/** Graded slab — taller portrait window aligned with evidence crop math. */
export const GRADED_SLAB_ASPECT = 0.475;

export type LiveGuideLayout = {
  width: number;
  height: number;
  centerX: number;
  centerY: number;
};

export function guideAspectForLane(laneMode: ScanLaneMode): number {
  return laneMode === "graded" ? GRADED_SLAB_ASPECT : TCG_CARD_ASPECT;
}

/**
 * Size the on-screen guide for portrait or landscape viewports.
 * Target ~72% fill inside safe area (Collectr / TCGplayer best practice: 60–80%).
 */
export function computeLiveGuideLayout(
  container: { width: number; height: number },
  laneMode: ScanLaneMode,
): LiveGuideLayout {
  const isLandscape = container.width > container.height;
  const aspect = guideAspectForLane(laneMode);

  const topInset = isLandscape ? 52 : 68;
  const bottomInset = isLandscape ? 96 : 148;
  const sideInset = isLandscape ? 40 : 14;

  const availW = Math.max(80, container.width - sideInset * 2);
  const availH = Math.max(120, container.height - topInset - bottomInset);
  const fill = isLandscape ? 0.78 : 0.74;

  let height = availH * fill;
  let width = height * aspect;

  if (width > availW * fill) {
    width = availW * fill;
    height = width / aspect;
  }

  const maxW = isLandscape ? 380 : 320;
  width = Math.max(132, Math.min(width, maxW));
  height = width / aspect;

  return {
    width,
    height,
    centerX: container.width / 2,
    centerY: topInset + availH / 2,
  };
}

/** Map a centered guide rect through object-cover video scaling → source pixels. */
export function guideRectToVideoCrop(
  video: HTMLVideoElement,
  container: { width: number; height: number },
  guide: LiveGuideLayout,
): { sx: number; sy: number; sw: number; sh: number } {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (vw < 2 || vh < 2) {
    throw new Error("Camera is not ready — wait for the preview to load.");
  }

  const elementAspect = container.width / container.height;
  const videoAspect = vw / vh;

  let displayedW: number;
  let displayedH: number;
  let offsetX: number;
  let offsetY: number;

  if (videoAspect > elementAspect) {
    displayedH = container.height;
    displayedW = container.height * videoAspect;
    offsetX = (container.width - displayedW) / 2;
    offsetY = 0;
  } else {
    displayedW = container.width;
    displayedH = container.width / videoAspect;
    offsetX = 0;
    offsetY = (container.height - displayedH) / 2;
  }

  const scaleX = vw / displayedW;
  const scaleY = vh / displayedH;

  const guideLeft = guide.centerX - guide.width / 2;
  const guideTop = guide.centerY - guide.height / 2;

  let sx = (guideLeft - offsetX) * scaleX;
  let sy = (guideTop - offsetY) * scaleY;
  let sw = guide.width * scaleX;
  let sh = guide.height * scaleY;

  sx = Math.max(0, Math.min(sx, vw - 1));
  sy = Math.max(0, Math.min(sy, vh - 1));
  sw = Math.max(1, Math.min(sw, vw - sx));
  sh = Math.max(1, Math.min(sh, vh - sy));

  return { sx, sy, sw, sh };
}

function renderCropJpeg(
  video: HTMLVideoElement,
  crop: { sx: number; sy: number; sw: number; sh: number },
  maxSide: number,
  quality: number,
): string | null {
  const scale = Math.min(1, maxSide / Math.max(crop.sw, crop.sh));
  const outW = Math.max(1, Math.round(crop.sw * scale));
  const outH = Math.max(1, Math.round(crop.sh * scale));

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(video, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, outW, outH);
  return canvas.toDataURL("image/jpeg", quality);
}

function renderFullFrameJpeg(
  video: HTMLVideoElement,
  maxSide: number,
  quality: number,
): string | null {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (w < 2 || h < 2) return null;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const outW = Math.max(1, Math.round(w * scale));
  const outH = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(video, 0, 0, w, h, 0, 0, outW, outH);
  return canvas.toDataURL("image/jpeg", quality);
}

/** Full camera frame for vision — matches upload single-card scan (art + set symbol visible). */
export async function captureVideoFrameForVision(video: HTMLVideoElement): Promise<string> {
  const dataUrl = renderFullFrameJpeg(video, LIVE_VISION_MAX_SIDE, LIVE_CAPTURE_JPEG_QUALITY);
  if (!dataUrl) throw new Error("Could not capture camera frame");
  return ensureScanUploadDataUrl(dataUrl);
}

/** Guide crop for evidence preview + precision re-read. */
export async function captureVideoFrameInGuide(
  video: HTMLVideoElement,
  container: { width: number; height: number },
  guide: LiveGuideLayout,
  maxSide: number = LIVE_EVIDENCE_MAX_SIDE,
): Promise<string> {
  const crop = guideRectToVideoCrop(video, container, guide);
  const dataUrl = renderCropJpeg(video, crop, maxSide, LIVE_CAPTURE_JPEG_QUALITY);
  if (!dataUrl) throw new Error("Could not capture camera frame");
  return ensureScanUploadDataUrl(dataUrl);
}

/** Vision frame + aligned evidence crop from the same moment. */
export async function captureLiveScanFrames(
  video: HTMLVideoElement,
  container: { width: number; height: number },
  guide: LiveGuideLayout,
): Promise<{ visionUrl: string; evidenceUrl: string }> {
  const [visionUrl, evidenceUrl] = await Promise.all([
    captureVideoFrameForVision(video),
    captureVideoFrameInGuide(video, container, guide),
  ]);
  return { visionUrl, evidenceUrl };
}
