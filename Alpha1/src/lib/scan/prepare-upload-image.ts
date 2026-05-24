/**
 * Normalize scan uploads for vision API requests.
 * Mobile cameras (especially Android) often produce 8–15MB files that exceed
 * Vercel's ~4.5MB serverless request body limit when sent as base64 JSON.
 */

/** Longest edge sent to vision — enough detail for multi-card binder reads. */
export const SCAN_UPLOAD_MAX_SIDE = 2048;

export const SCAN_UPLOAD_JPEG_QUALITY = 0.85;

/** Base64 payload budget (JSON wrapper + margin under Vercel ~4.5MB cap). */
export const SCAN_UPLOAD_MAX_BASE64_CHARS = 3_200_000;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

type DrawableSource = {
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, outW: number, outH: number) => void;
  dispose?: () => void;
};

async function loadDrawableFromFile(file: File): Promise<DrawableSource> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw: (ctx, outW, outH) => {
          ctx.drawImage(bitmap, 0, 0, outW, outH);
        },
        dispose: () => bitmap.close(),
      };
    } catch {
      // Fall through to <img> path (older WebViews).
    }
  }

  const dataUrl = await readFileAsDataUrl(file);
  const img = await loadImageElement(dataUrl);
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;
  return {
    width,
    height,
    draw: (ctx, outW, outH) => {
      ctx.drawImage(img, 0, 0, outW, outH);
    },
  };
}

async function loadDrawableFromDataUrl(dataUrl: string): Promise<DrawableSource> {
  const img = await loadImageElement(dataUrl);
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;
  return {
    width,
    height,
    draw: (ctx, outW, outH) => {
      ctx.drawImage(img, 0, 0, outW, outH);
    },
  };
}

function base64CharsInDataUrl(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  return comma >= 0 ? dataUrl.length - comma - 1 : dataUrl.length;
}

function renderJpeg(
  source: DrawableSource,
  maxSide: number,
  quality: number,
): string | null {
  const { width, height } = source;
  if (width < 2 || height < 2) return null;

  const scale = Math.min(1, maxSide / Math.max(width, height));
  const outW = Math.max(1, Math.round(width * scale));
  const outH = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  source.draw(ctx, outW, outH);
  return canvas.toDataURL("image/jpeg", quality);
}

function encodeUnderBudget(
  source: DrawableSource,
  maxSide: number,
  quality: number,
): string {
  let side = maxSide;
  let q = quality;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const dataUrl = renderJpeg(source, side, q);
    if (!dataUrl) break;
    if (base64CharsInDataUrl(dataUrl) <= SCAN_UPLOAD_MAX_BASE64_CHARS) {
      return dataUrl;
    }
    q = Math.max(0.55, q - 0.08);
    side = Math.max(960, Math.round(side * 0.88));
  }

  const fallback = renderJpeg(source, 960, 0.6);
  if (!fallback) {
    throw new Error("Could not prepare image for upload");
  }
  return fallback;
}

/** Resize, correct orientation, and compress a file for scan preview + vision upload. */
export async function prepareScanUploadDataUrl(file: File): Promise<string> {
  const source = await loadDrawableFromFile(file);
  try {
    return encodeUnderBudget(source, SCAN_UPLOAD_MAX_SIDE, SCAN_UPLOAD_JPEG_QUALITY);
  } finally {
    source.dispose?.();
  }
}

/** Re-encode an existing data URL if it is still too large for the API gateway. */
export async function ensureScanUploadDataUrl(dataUrl: string): Promise<string> {
  if (base64CharsInDataUrl(dataUrl) <= SCAN_UPLOAD_MAX_BASE64_CHARS) {
    return dataUrl;
  }
  const source = await loadDrawableFromDataUrl(dataUrl);
  return encodeUnderBudget(source, SCAN_UPLOAD_MAX_SIDE, SCAN_UPLOAD_JPEG_QUALITY);
}

/** Capture a live camera frame with the same compression path as file uploads. */
export async function captureVideoFrameToDataUrl(video: HTMLVideoElement): Promise<string> {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (w < 2 || h < 2) {
    throw new Error("Camera is not ready — wait for the preview to load.");
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not capture camera frame");
  ctx.drawImage(video, 0, 0, w, h);
  const raw = canvas.toDataURL("image/jpeg", SCAN_UPLOAD_JPEG_QUALITY);
  return ensureScanUploadDataUrl(raw);
}

export async function dataUrlToJpegFile(dataUrl: string, filename: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || "image/jpeg" });
}
