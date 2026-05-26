/** Client preference: Speed on = faster pipeline; off = cost control (fewer API calls). */

export const LIQUID_SCAN_SPEED_STORAGE_KEY = "pgt-liquid-scan-speed-on";

export type LiquidScanSpeedProfile = {
  visionConcurrency: number;
  catalogConcurrency: number;
  marketConcurrency: number;
  precisionConcurrency: number;
  skipRegistryOnBulkEnrich: boolean;
  precisionCropEnabled: boolean;
  precisionCropMax: number;
  autoSessionReport: boolean;
};

export function readLiquidScanSpeedOn(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(LIQUID_SCAN_SPEED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeLiquidScanSpeedOn(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LIQUID_SCAN_SPEED_STORAGE_KEY, on ? "1" : "0");
  } catch {
    // ignore quota / private mode
  }
}

export function getLiquidScanSpeedProfile(speedOn: boolean): LiquidScanSpeedProfile {
  if (speedOn) {
    return {
      visionConcurrency: 3,
      catalogConcurrency: 6,
      marketConcurrency: 4,
      precisionConcurrency: 2,
      skipRegistryOnBulkEnrich: false,
      precisionCropEnabled: true,
      precisionCropMax: 6,
      autoSessionReport: true,
    };
  }
  return {
    visionConcurrency: 2,
    catalogConcurrency: 3,
    marketConcurrency: 2,
    precisionConcurrency: 1,
    skipRegistryOnBulkEnrich: true,
    precisionCropEnabled: true,
    precisionCropMax: 5,
    autoSessionReport: false,
  };
}

/** Scale precision-crop budget for dense binder/grid captures (weak set/# rows). */
export function precisionCropMaxForCardCount(
  cardCount: number,
  profile: LiquidScanSpeedProfile,
): number {
  const base = profile.precisionCropMax;
  if (cardCount >= 20) return Math.max(base, 8);
  if (cardCount >= 12) return Math.max(base, 6);
  return base;
}

export function shouldAutoSessionReport(speedOn: boolean): boolean {
  return getLiquidScanSpeedProfile(speedOn).autoSessionReport;
}
