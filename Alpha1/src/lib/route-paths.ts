/** Legacy `/scanner` URLs (redirect to Liquid Scan; no standalone UI). */
export function isLegacyScannerPath(pathname: string): boolean {
  if (isLiquidScanPath(pathname)) return false;
  return pathname === "/scanner" || pathname.startsWith("/scanner/");
}

/** True for PGT Liquid Scan at `/liquid-scan`. */
export function isLiquidScanPath(pathname: string): boolean {
  return pathname === "/liquid-scan" || pathname.startsWith("/liquid-scan/");
}

/** @deprecated Use isLiquidScanPath */
export const isScannerChatPath = isLiquidScanPath;

/** Full-bleed scanner experiences (no global header/dock). */
export function isFullBleedScannerPath(pathname: string): boolean {
  return isLegacyScannerPath(pathname) || isLiquidScanPath(pathname);
}
