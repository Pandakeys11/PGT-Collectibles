/**
 * Mild scanner-style post-processing on cropped card regions.
 */

function loadImageElement(imageSrc: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = imageSrc;
  });
}

/** Stretch luminance toward full range without clipping highlights. */
function applyMildContrastNormalize(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;
  let min = 255;
  let max = 0;
  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
    if (lum < min) min = lum;
    if (lum > max) max = lum;
  }
  const range = max - min;
  if (range < 24 || range > 240) return;
  const scale = 235 / range;
  const offset = 10 - min * scale;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.max(0, Math.min(255, data[i]! * scale + offset));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1]! * scale + offset));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2]! * scale + offset));
  }
  ctx.putImageData(imageData, 0, 0);
}

export async function postProcessScannerCanvas(
  canvas: HTMLCanvasElement,
  options: { normalizeContrast: boolean; borderPx: number },
): Promise<{ width: number; height: number }> {
  const ctx = canvas.getContext("2d");
  if (!ctx) return { width: canvas.width, height: canvas.height };

  if (options.normalizeContrast) {
    applyMildContrastNormalize(ctx, canvas.width, canvas.height);
  }

  if (options.borderPx > 0) {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = options.borderPx;
    ctx.strokeRect(
      options.borderPx / 2,
      options.borderPx / 2,
      canvas.width - options.borderPx,
      canvas.height - options.borderPx,
    );
  }

  return { width: canvas.width, height: canvas.height };
}

export async function dataUrlToSha256(dataUrl: string): Promise<string | null> {
  if (typeof crypto === "undefined" || !crypto.subtle) return null;
  try {
    const base64 = dataUrl.split(",")[1];
    if (!base64) return null;
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    const hash = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return null;
  }
}

export { loadImageElement };
