export type LiquidCameraMode = "picture" | "live-scan";

const STORAGE_KEY = "pgt-liquid-camera-mode";

export function readLiquidCameraMode(): LiquidCameraMode {
  if (typeof window === "undefined") return "live-scan";
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === "picture" ? "picture" : "live-scan";
  } catch {
    return "live-scan";
  }
}

export function writeLiquidCameraMode(mode: LiquidCameraMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // ignore
  }
}
