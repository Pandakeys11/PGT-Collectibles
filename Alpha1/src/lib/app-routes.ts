/** Legacy URL — `/scanner` redirects to Liquid Scan (query mapping below). */
export const LEGACY_SCANNER_PATH = "/scanner";

/** PGT Liquid Scan — primary app shell (AI chat scanner). */
export const LIQUID_SCAN_PATH = "/liquid-scan";

/** Default post-auth and `/` redirect target. */
export const APP_HOME_PATH = LIQUID_SCAN_PATH;

/** Phase C — institutional market page for a locked Pokémon `catalog_id`. */
export function marketPokemonHref(catalogId: string): string {
  const id = catalogId.trim();
  return `/market/pokemon/${encodeURIComponent(id)}`;
}

/** @deprecated Use LIQUID_SCAN_PATH */
export const SCANNER_PATH = LEGACY_SCANNER_PATH;

/** @deprecated Use LIQUID_SCAN_PATH */
export const SCANNER_CHAT_PATH = LIQUID_SCAN_PATH;

export type LiquidScanPanel = "catalog" | "companion" | "calculator" | "live-market";

/** Maps legacy `/scanner?view=*` bookmarks to Liquid Scan panels. */
export function legacyScannerRedirectUrl(searchParams: URLSearchParams): string {
  const out = new URLSearchParams(searchParams);
  const view = out.get("view")?.trim().toLowerCase();
  out.delete("view");
  if (view === "catalog") out.set("panel", "catalog");
  else if (view === "ai") out.set("panel", "companion");
  else if (view === "calculator") out.set("panel", "calculator");
  else if (view === "market" || view === "live-market") out.set("panel", "live-market");
  const q = out.toString();
  return q ? `${LIQUID_SCAN_PATH}?${q}` : LIQUID_SCAN_PATH;
}

export function liquidScanHref(panel?: LiquidScanPanel): string {
  if (panel === "catalog") return `${LIQUID_SCAN_PATH}?panel=catalog`;
  if (panel === "companion") return `${LIQUID_SCAN_PATH}?panel=companion`;
  if (panel === "calculator") return `${LIQUID_SCAN_PATH}?panel=calculator`;
  if (panel === "live-market") return `${LIQUID_SCAN_PATH}?panel=live-market`;
  return LIQUID_SCAN_PATH;
}

/** @deprecated Use liquidScanHref */
export function scannerHref(view?: "scanner" | "catalog" | "market" | "ai"): string {
  if (view === "catalog") return liquidScanHref("catalog");
  if (view === "ai") return liquidScanHref("companion");
  return LIQUID_SCAN_PATH;
}
