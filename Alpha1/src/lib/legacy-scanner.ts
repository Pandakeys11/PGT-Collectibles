/** When `LEGACY_SCANNER_ENABLED=0`, `/scanner` returns 410 instead of redirecting to Liquid Scan. */
export function isLegacyScannerRedirectDisabled(): boolean {
  return process.env.LEGACY_SCANNER_ENABLED === "0";
}

export const LEGACY_SCANNER_GONE_MESSAGE =
  "The legacy command center was removed. Use PGT Liquid Scan at /liquid-scan.";
