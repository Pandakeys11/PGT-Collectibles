/** Primary app shell: command center (scanner desk). */
export const SCANNER_PATH = "/scanner";

export type ScannerView = "scanner" | "catalog" | "market" | "ai";

export function scannerHref(view?: ScannerView): string {
  if (!view || view === "scanner") return SCANNER_PATH;
  return `${SCANNER_PATH}?view=${view}`;
}

export function moduleFromViewParam(raw: string | null | undefined): ScannerView | null {
  const view = raw?.trim().toLowerCase();
  if (view === "scan") return "scanner";
  if (view === "scanner" || view === "catalog" || view === "market" || view === "ai") {
    return view;
  }
  return null;
}
