export type LiquidCameraMode = "picture" | "live-scan";

export type LiquidCameraPrefs = {
  mode: LiquidCameraMode;
  /** Rapid scan: save to session when match locks (camera stays open). */
  autoAddOnLock: boolean;
};

const STORAGE_KEY = "pgt-liquid-camera-prefs";
const LEGACY_MODE_KEY = "pgt-liquid-camera-mode";

const DEFAULT_PREFS: LiquidCameraPrefs = {
  mode: "live-scan",
  autoAddOnLock: false,
};

function readRawPrefs(): Partial<LiquidCameraPrefs> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Partial<LiquidCameraPrefs>;
    const legacy = localStorage.getItem(LEGACY_MODE_KEY);
    if (legacy === "picture" || legacy === "live-scan") {
      return { mode: legacy };
    }
  } catch {
    // ignore
  }
  return {};
}

export function readLiquidCameraPrefs(): LiquidCameraPrefs {
  const raw = readRawPrefs();
  return {
    mode: raw.mode === "picture" ? "picture" : "live-scan",
    autoAddOnLock: Boolean(raw.autoAddOnLock),
  };
}

export function writeLiquidCameraPrefs(prefs: LiquidCameraPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    localStorage.setItem(LEGACY_MODE_KEY, prefs.mode);
  } catch {
    // ignore
  }
}

export function patchLiquidCameraPrefs(patch: Partial<LiquidCameraPrefs>): LiquidCameraPrefs {
  const next = { ...readLiquidCameraPrefs(), ...patch };
  writeLiquidCameraPrefs(next);
  return next;
}

/** @deprecated use readLiquidCameraPrefs */
export function readLiquidCameraMode(): LiquidCameraMode {
  return readLiquidCameraPrefs().mode;
}

/** @deprecated use writeLiquidCameraPrefs */
export function writeLiquidCameraMode(mode: LiquidCameraMode): void {
  patchLiquidCameraPrefs({ mode });
}
