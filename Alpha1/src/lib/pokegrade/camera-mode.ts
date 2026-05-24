export type LiquidCameraMode = "picture" | "live-scan";

const STORAGE_KEY = "pgt-liquid-camera-mode";

export function readLiquidCameraMode(): LiquidCameraMode {
  if (typeof window === "undefined") return "picture";
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === "live-scan" ? "live-scan" : "picture";
  } catch {
    return "picture";
  }
}

export function writeLiquidCameraMode(mode: LiquidCameraMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // ignore
  }
}
