import type { ScanLaneMode } from "@/lib/scan/build-specimens";
import type { ScanMode } from "./types";

export type LiquidScanKind = "binder" | "single" | "graded";

export type LiquidScanStrategy = {
  kind: LiquidScanKind;
  laneMode: ScanLaneMode;
  binderGrid: boolean;
  singleCardCrop: boolean;
  gradedFocus: boolean;
  visionVerify: boolean;
  binderUploadPrep: boolean;
  /** Skip client-side tiling — one vision call on the full upload. */
  forceFullPageBinder?: boolean;
};

export type ResolveLiquidScanStrategyInput = {
  imageCount: number;
  /** Width ÷ height when scanning a single capture */
  captureAspect?: number;
  speedOn?: boolean;
  /** Non-auto modes from legacy UI or saved state */
  manualMode?: ScanMode;
};

/** Landscape / table flat-lay (binder page or slab table) */
const TABLE_FLAT_ASPECT_MIN = 0.92;
/** Portrait phone shot of a multi-row grid (slabs or binder) */
const PORTRAIT_GRID_ASPECT_MAX = 0.78;
/** Portrait close-up of one slab (not a full grid photo) */
const SINGLE_SLAB_ASPECT_MAX = 0.88;

/** True when the photo is likely a multi-card page or slab table (not a tight single-slab crop). */
export function isFlatLayCapture(aspect?: number): boolean {
  if (aspect == null || !Number.isFinite(aspect)) return true;
  if (aspect <= PORTRAIT_GRID_ASPECT_MAX) return true;
  if (aspect >= TABLE_FLAT_ASPECT_MIN) return true;
  return false;
}

function strategyFromManualMode(mode: ScanMode, imageCount: number): LiquidScanStrategy {
  const laneMode: ScanLaneMode = mode === "graded" ? "graded" : "all";
  const oneImage = imageCount === 1;
  const binderGrid = oneImage && mode === "binder" && laneMode !== "graded";
  const singleCardCrop =
    imageCount > 1 ||
    (oneImage &&
      (laneMode === "graded" || mode === "fast" || mode === "deep" || mode === "market"));
  return {
    kind: mode === "binder" ? "binder" : mode === "graded" ? "graded" : "single",
    laneMode,
    binderGrid,
    singleCardCrop,
    gradedFocus: laneMode === "graded",
    visionVerify: mode === "deep" && oneImage,
    binderUploadPrep: binderGrid,
  };
}

/** Infer vision/upload strategy from photo layout (one pipeline for Fast / Binder / Graded). */
export function resolveLiquidScanStrategy(
  input: ResolveLiquidScanStrategyInput,
): LiquidScanStrategy {
  const { imageCount, captureAspect, speedOn, manualMode } = input;

  if (manualMode && manualMode !== "auto") {
    return strategyFromManualMode(manualMode, imageCount);
  }

  if (imageCount > 1) {
    return {
      kind: "single",
      laneMode: "all",
      binderGrid: false,
      singleCardCrop: true,
      gradedFocus: true,
      visionVerify: speedOn !== true,
      binderUploadPrep: false,
    };
  }

  if (imageCount <= 0) {
    return {
      kind: "single",
      laneMode: "all",
      binderGrid: false,
      singleCardCrop: false,
      gradedFocus: false,
      visionVerify: false,
      binderUploadPrep: false,
    };
  }

  const aspect = captureAspect;

  if (isFlatLayCapture(aspect)) {
    return {
      kind: "binder",
      laneMode: "all",
      binderGrid: true,
      singleCardCrop: false,
      gradedFocus: true,
      visionVerify: false,
      binderUploadPrep: true,
    };
  }

  if (aspect != null && aspect <= SINGLE_SLAB_ASPECT_MAX) {
    return {
      kind: "graded",
      laneMode: "all",
      binderGrid: false,
      singleCardCrop: true,
      gradedFocus: true,
      visionVerify: speedOn !== true,
      binderUploadPrep: false,
    };
  }

  return {
    kind: "single",
    laneMode: "all",
    binderGrid: false,
    singleCardCrop: true,
    gradedFocus: true,
    visionVerify: speedOn !== true,
    binderUploadPrep: false,
  };
}

/** When the first pass finds no cards, try the other single-image layout. */
export function alternateLiquidScanStrategy(
  current: LiquidScanStrategy,
  captureAspect?: number,
): LiquidScanStrategy | null {
  if (current.binderGrid) {
    const aspect = captureAspect ?? 1;
    return {
      kind: aspect <= SINGLE_SLAB_ASPECT_MAX ? "graded" : "single",
      laneMode: "all",
      binderGrid: false,
      singleCardCrop: true,
      gradedFocus: true,
      visionVerify: true,
      binderUploadPrep: false,
    };
  }
  if (current.singleCardCrop && isFlatLayCapture(captureAspect)) {
    return {
      kind: "binder",
      laneMode: "all",
      binderGrid: true,
      singleCardCrop: false,
      gradedFocus: true,
      visionVerify: false,
      binderUploadPrep: true,
    };
  }
  return null;
}

const FLAT_LAY_MIN_CARDS = 4;

/** Re-run as full-page binder + slab OCR when a table shot returned too few rows. */
export function sparseFlatLayRetryStrategy(
  current: LiquidScanStrategy,
  captureAspect: number | undefined,
  cardCount: number,
): LiquidScanStrategy | null {
  if (cardCount >= FLAT_LAY_MIN_CARDS) return null;
  if (!isFlatLayCapture(captureAspect)) return null;

  const target: LiquidScanStrategy = {
    kind: "binder",
    laneMode: "all",
    binderGrid: true,
    singleCardCrop: false,
    gradedFocus: true,
    visionVerify: false,
    binderUploadPrep: true,
  };

  if (
    current.binderGrid === target.binderGrid &&
    current.gradedFocus === target.gradedFocus &&
    current.singleCardCrop === target.singleCardCrop
  ) {
    if (current.forceFullPageBinder) return null;
    return { ...target, forceFullPageBinder: true };
  }
  return target;
}

export function liquidScanProgressLabel(kind: LiquidScanKind): string {
  switch (kind) {
    case "binder":
      return "Scanning page or slab table…";
    case "graded":
      return "Reading graded slab…";
    default:
      return "Running vision extraction…";
  }
}

/** Read capture aspect from a File before upload prep (best-effort). */
export async function readFileCaptureAspect(file: File): Promise<number | undefined> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      const aspect = bitmap.width / Math.max(1, bitmap.height);
      bitmap.close?.();
      return aspect;
    } catch {
      try {
        const bitmap = await createImageBitmap(file);
        const aspect = bitmap.width / Math.max(1, bitmap.height);
        bitmap.close?.();
        return aspect;
      } catch {
        // fall through
      }
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<number>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve(img.naturalWidth / Math.max(1, img.naturalHeight));
      };
      img.onerror = () => reject(new Error("decode failed"));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
