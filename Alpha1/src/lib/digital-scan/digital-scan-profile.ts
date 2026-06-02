export const DIGITAL_SCAN_STORAGE_KEY = "pgt-liquid-scan-digital-on";
export const DIGITAL_SCAN_PNG_STORAGE_KEY = "pgt-liquid-scan-digital-png";

export type DigitalScanRenderPreset = {
  maxOutputSide: number;
  quality: number;
  mime: "image/jpeg" | "image/png";
  paddingRatio?: number;
  borderPx: number;
  normalizeContrast: boolean;
};

const FREE_RAW: DigitalScanRenderPreset = {
  maxOutputSide: 2200,
  quality: 0.94,
  mime: "image/jpeg",
  borderPx: 1,
  normalizeContrast: true,
};

const PRO_RAW: DigitalScanRenderPreset = {
  maxOutputSide: 2800,
  quality: 0.97,
  mime: "image/jpeg",
  borderPx: 1,
  normalizeContrast: true,
};

const FREE_GRADED: DigitalScanRenderPreset = {
  maxOutputSide: 2400,
  quality: 0.94,
  mime: "image/jpeg",
  paddingRatio: 0.05,
  borderPx: 1,
  normalizeContrast: true,
};

const PRO_GRADED: DigitalScanRenderPreset = {
  maxOutputSide: 3200,
  quality: 0.97,
  mime: "image/jpeg",
  paddingRatio: 0.05,
  borderPx: 1,
  normalizeContrast: true,
};

export function readDigitalScanOn(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DIGITAL_SCAN_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeDigitalScanOn(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DIGITAL_SCAN_STORAGE_KEY, on ? "1" : "0");
  } catch {
    // ignore
  }
}

export function readDigitalScanPngExport(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DIGITAL_SCAN_PNG_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeDigitalScanPngExport(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DIGITAL_SCAN_PNG_STORAGE_KEY, on ? "1" : "0");
  } catch {
    // ignore
  }
}

export function getDigitalScanPreset(
  lane: "raw" | "graded",
  isPro: boolean,
  preferPng: boolean,
): DigitalScanRenderPreset {
  const base = lane === "graded" ? (isPro ? PRO_GRADED : FREE_GRADED) : isPro ? PRO_RAW : FREE_RAW;
  if (!preferPng) return base;
  return { ...base, mime: "image/png", quality: 1 };
}

export const DIGITAL_SCAN_HOW_TO_MESSAGE_ID = "digital-scan-how-to";
