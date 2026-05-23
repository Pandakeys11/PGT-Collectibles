import type { ScanSpecimen } from "@/hooks/use-scan-session";
import { franchiseLabel } from "@/lib/scan/franchise";
import {
  liquidScanSheetRowsToCsv,
  specimensToLiquidScanSheetRows,
} from "@/lib/scan/liquid-scan-sheet";
import {
  formatFairMarketValue,
  formatLatestActive,
  formatLatestBgsBlackLabelSold,
  formatLatestPsa10Sold,
  formatLatestRawSold,
  formatSourcesSummary,
  formatStickerPrice,
} from "@/lib/scan/sheet-present";

export type SpecimenSheetRow = {
  row: number;
  franchise: string;
  name: string;
  printedName: string;
  language: string;
  set: string;
  cardId: string;
  year: string;
  rarity: string;
  printStamps: string;
  sticker: string;
  fairMarketValue: string;
  fmvBasis: string;
  psa10Sold: string;
  bgsBlackLabelSold: string;
  recentSold: string;
  listed: string;
  sources: string;
  status: string;
  details: string;
};

export function specimensToSheetRows(
  specimens: ScanSpecimen[],
): SpecimenSheetRow[] {
  return specimens.map((item, index) => ({
    row: index + 1,
    franchise: item.card.franchise ?? franchiseLabel(item.card),
    name: item.card.name,
    printedName: item.card.printedName ?? "",
    language: item.card.language ?? "",
    set: item.card.set ?? "",
    cardId: item.card.number ?? "",
    year: item.card.year ?? item.context.year ?? "",
    rarity: item.card.rarity ?? "",
    printStamps: item.card.printStamps ?? "",
    sticker: formatStickerPrice(item),
    fairMarketValue: formatFairMarketValue(item),
    fmvBasis: item.context.fairValueBasis ?? "",
    psa10Sold: formatLatestPsa10Sold(item),
    bgsBlackLabelSold: formatLatestBgsBlackLabelSold(item),
    recentSold: formatLatestRawSold(item),
    listed: formatLatestActive(item),
    sources: formatSourcesSummary(item),
    status: item.context.verificationStatus,
    details: item.card.details ?? "",
  }));
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function timestampSlug() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

const EMPTY_ROW: SpecimenSheetRow = {
  row: 1,
  franchise: "",
  name: "",
  printedName: "",
  language: "",
  set: "",
  cardId: "",
  year: "",
  rarity: "",
  printStamps: "",
  sticker: "",
  fairMarketValue: "",
  fmvBasis: "",
  psa10Sold: "",
  bgsBlackLabelSold: "",
  recentSold: "",
  listed: "",
  sources: "",
  status: "",
  details: "",
};

export function downloadSpecimensCsv(specimens: ScanSpecimen[]) {
  const rows = specimensToLiquidScanSheetRows(specimens);
  downloadBlob(
    `pgt-liquid-scan-sheet-${timestampSlug()}.csv`,
    new Blob([liquidScanSheetRowsToCsv(rows)], { type: "text/csv;charset=utf-8" }),
  );
}

/** Legacy wide export (franchise, PSA10, BGS BL columns) — internal / tooling. */
export function downloadSpecimensCsvLegacy(specimens: ScanSpecimen[]) {
  const rows = specimensToSheetRows(specimens);
  const headers = Object.keys(rows[0] ?? EMPTY_ROW);
  const escape = (value: string | number) => {
    const text = String(value ?? "");
    if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  };
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((key) => escape(row[key as keyof SpecimenSheetRow] ?? ""))
        .join(","),
    ),
  ];
  downloadBlob(
    `pgt-collectibles-scan-${timestampSlug()}.csv`,
    new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }),
  );
}

export function downloadSpecimensJson(specimens: ScanSpecimen[]) {
  const payload = specimens.map((item) => ({
    id: item.id,
    card: item.card,
    context: item.context,
  }));
  downloadBlob(
    `pgt-collectibles-scan-${timestampSlug()}.json`,
    new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
  );
}
