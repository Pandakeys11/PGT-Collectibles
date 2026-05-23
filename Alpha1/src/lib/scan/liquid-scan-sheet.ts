import type { ScanSpecimen } from "@/hooks/use-scan-session";
import { getCardDisplayTitle } from "@/lib/scan/card-display";
import {
  formatGradedSlabTag,
  hasReadableCertNumber,
  isCertNotApplicable,
  normalizeGradedSlabFields,
} from "@/lib/scan/graded-slab";
import {
  displayPrintPromoForSpecimen,
  displayPrintVersion,
  displayPrintVersionForSpecimen,
} from "@/lib/scan/display-print-edition";
import {
  formatFairMarketValue,
  formatLatestRawSold,
  formatSourcesSummary,
  formatStickerPrice,
} from "@/lib/scan/sheet-present";
import { sortEvidenceNewestFirst } from "@/lib/scan/market-intelligence";

export type LiquidScanSheetRow = {
  row: number;
  name: string;
  set: string;
  year: string;
  cardId: string;
  promo: string;
  version: string;
  grader: string;
  grade: string;
  cert: string;
  condition: string;
  sticker: string;
  fairMarketValue: string;
  recentSold: string;
  sources: string;
  status: string;
};

export type LiquidScanSheetColumn = {
  key: keyof LiquidScanSheetRow;
  label: string;
  /** Tailwind min-width for horizontal scroll table */
  minWidth: string;
  align?: "left" | "right";
};

export const LIQUID_SCAN_SHEET_COLUMNS: LiquidScanSheetColumn[] = [
  { key: "row", label: "#", minWidth: "2.25rem", align: "right" },
  { key: "name", label: "Name", minWidth: "7.5rem" },
  { key: "set", label: "Set", minWidth: "6.5rem" },
  { key: "year", label: "Year", minWidth: "3.25rem" },
  { key: "cardId", label: "ID", minWidth: "3.5rem" },
  { key: "promo", label: "Promo", minWidth: "4rem" },
  { key: "version", label: "Version", minWidth: "5.5rem" },
  { key: "grader", label: "Grader", minWidth: "3.5rem" },
  { key: "grade", label: "Grade", minWidth: "3.25rem" },
  { key: "cert", label: "Cert", minWidth: "4.5rem" },
  { key: "condition", label: "Condition", minWidth: "5rem" },
  { key: "sticker", label: "Sticker", minWidth: "4rem", align: "right" },
  { key: "fairMarketValue", label: "FMV", minWidth: "5rem", align: "right" },
  { key: "recentSold", label: "Recent sold", minWidth: "9rem" },
  { key: "sources", label: "Sources", minWidth: "8rem" },
  { key: "status", label: "Status", minWidth: "4.5rem" },
];

function sheetCondition(specimen: ScanSpecimen): string {
  if (specimen.context.lane === "graded") {
    const tag = formatGradedSlabTag(
      normalizeGradedSlabFields(specimen.card, "graded"),
      "graded",
    );
    if (tag) return tag;
  }
  const details = specimen.card.details?.trim();
  const editionLabel = displayPrintVersion(specimen.card, specimen.context.variantLabel);
  if (details && !/resolving identity|pending/i.test(details)) {
    if (editionLabel && details.includes(editionLabel)) return "—";
    return details;
  }
  return "—";
}

function sheetGraderGradeCert(specimen: ScanSpecimen): {
  grader: string;
  grade: string;
  cert: string;
} {
  if (specimen.context.lane !== "graded") {
    return { grader: "—", grade: "—", cert: "—" };
  }
  const card = normalizeGradedSlabFields(specimen.card, "graded");
  const grader = card.grader?.trim() || "—";
  const grade = card.grade?.trim() || "—";
  let cert = "—";
  if (hasReadableCertNumber(card.cert)) {
    cert = card.cert!.replace(/\s/g, "");
  } else if (isCertNotApplicable(card.cert)) {
    cert = "NA";
  } else if (card.cert?.trim()) {
    cert = card.cert.trim();
  }
  return { grader, grade, cert };
}

/** Grade-aware latest sold line for spreadsheet export. */
function sheetRecentSold(specimen: ScanSpecimen): string {
  const solds = sortEvidenceNewestFirst(
    specimen.context.marketEvidence.filter((e) => e.kind === "sold" && e.priceUsd != null),
  );
  if (solds.length > 0) {
    const top = solds[0]!;
    const price = `$${Math.round(top.priceUsd!).toLocaleString()}`;
    const date = top.observedAt
      ? new Date(top.observedAt).toLocaleDateString()
      : "n/a";
    const src = top.source ?? "market";
    const slab = top.slab?.trim();
    return slab ? `${price} · ${slab} · ${date} · ${src}` : `${price} · ${date} · ${src}`;
  }
  return formatLatestRawSold(specimen);
}

function isRowAwaitingEnrichment(specimen: ScanSpecimen): boolean {
  const ctx = specimen.context;
  return (
    ctx.catalogCandidates.length === 0 &&
    ctx.marketEvidence.length === 0 &&
    ctx.fairValueUsd == null &&
    ctx.catalogIdentityStatus === "failed"
  );
}

function sheetStatus(specimen: ScanSpecimen): string {
  if (isRowAwaitingEnrichment(specimen)) return "Enriching";
  const catalog = specimen.context.catalogIdentityStatus;
  const verify = specimen.context.verificationStatus;
  if (catalog === "confirmed" && verify === "verified") return "Verified";
  if (catalog === "ambiguous") return "Ambiguous";
  if (catalog === "failed") return "Unmatched";
  if (verify === "verified") return "Verified";
  return "Review";
}

export function specimensToLiquidScanSheetRows(
  specimens: ScanSpecimen[],
): LiquidScanSheetRow[] {
  return specimens.map((item, index) => {
    const { grader, grade, cert } = sheetGraderGradeCert(item);
    return {
      row: index + 1,
      name: getCardDisplayTitle(item.card),
      set: item.context.setName ?? item.card.set ?? "—",
      year: item.context.year ?? item.card.year ?? "—",
      cardId: item.context.cardNumber ?? item.card.number ?? "—",
      promo: displayPrintPromoForSpecimen(item),
      version: displayPrintVersionForSpecimen(item),
      grader,
      grade,
      cert,
      condition: sheetCondition(item),
      sticker: formatStickerPrice(item),
      fairMarketValue: formatFairMarketValue(item),
      recentSold: sheetRecentSold(item),
      sources: formatSourcesSummary(item),
      status: sheetStatus(item),
    };
  });
}

export function liquidScanSheetRowsToCsv(rows: LiquidScanSheetRow[]): string {
  const headers = LIQUID_SCAN_SHEET_COLUMNS.map((c) => c.label);
  const keys = LIQUID_SCAN_SHEET_COLUMNS.map((c) => c.key);
  const escape = (value: string | number) => {
    const text = String(value ?? "");
    if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  };
  const lines = [
    headers.join(","),
    ...rows.map((row) => keys.map((key) => escape(row[key])).join(",")),
  ];
  return lines.join("\n");
}
