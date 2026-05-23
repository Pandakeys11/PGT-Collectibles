"use client";

import { useMemo } from "react";
import { Copy, Download, Table2 } from "lucide-react";
import type { ScanSpecimen } from "@/hooks/use-scan-session";
import {
  LIQUID_SCAN_SHEET_COLUMNS,
  liquidScanSheetRowsToCsv,
  specimensToLiquidScanSheetRows,
} from "@/lib/scan/liquid-scan-sheet";
import { cn } from "@/lib/cn";

function timestampSlug() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

/** Touch-friendly row list for mobile — version/edition always visible. */
export function ScanResultsMobileList({
  specimens,
  className,
  onRowSelect,
  selectedSpecimenId,
}: {
  specimens: ScanSpecimen[];
  className?: string;
  onRowSelect?: (specimenId: string) => void;
  selectedSpecimenId?: string | null;
}) {
  const rows = useMemo(() => specimensToLiquidScanSheetRows(specimens), [specimens]);

  if (specimens.length === 0) return null;

  return (
    <ul className={cn("sc-scan-mobile-list space-y-2", className)}>
      {rows.map((row, i) => {
        const specimen = specimens[i];
        const selected = specimen && selectedSpecimenId === specimen.id;
        const hasVersion = row.version !== "—";
        const hasPromo = row.promo !== "—" && row.promo !== row.version;
        return (
          <li key={specimen?.id ?? row.row}>
            <button
              type="button"
              onClick={() => {
                if (specimen && onRowSelect) onRowSelect(specimen.id);
              }}
              className={cn(
                "w-full rounded-xl border px-3 py-2.5 text-left transition touch-manipulation",
                selected
                  ? "border-emerald-500/35 bg-emerald-500/10 ring-1 ring-emerald-500/25"
                  : "border-white/8 bg-white/[0.03] active:bg-white/[0.06]",
                onRowSelect && specimen && "cursor-pointer",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold leading-snug text-slate-100">
                    <span className="mr-1.5 font-mono text-[10px] text-slate-500">#{row.row}</span>
                    {row.name}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-slate-500">
                    {row.set} · {row.cardId} · {row.year}
                  </p>
                </div>
                <p className="shrink-0 font-mono text-sm font-semibold tabular-nums text-emerald-300/95">
                  {row.fairMarketValue}
                </p>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {hasVersion ? (
                  <span className="rounded-md border border-violet-500/30 bg-violet-500/12 px-2 py-0.5 text-[10px] font-medium text-violet-100">
                    {row.version}
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-600">Version —</span>
                )}
                {hasPromo ? (
                  <span className="rounded-md border border-fuchsia-500/25 bg-fuchsia-500/10 px-2 py-0.5 text-[10px] font-medium text-fuchsia-100/90">
                    {row.promo}
                  </span>
                ) : null}
                {row.grader !== "—" ? (
                  <span className="rounded-md bg-sky-500/12 px-2 py-0.5 text-[10px] text-sky-200/90">
                    {row.grader} {row.grade}
                  </span>
                ) : null}
                <span
                  className={cn(
                    "ml-auto text-[10px] font-medium",
                    row.status === "Verified"
                      ? "text-emerald-400/90"
                      : row.status === "Review"
                        ? "text-amber-400/90"
                        : "text-slate-500",
                  )}
                >
                  {row.status}
                </span>
              </div>
              {row.sticker !== "—" ? (
                <p className="mt-1.5 text-[10px] text-amber-200/80">Sticker {row.sticker}</p>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function ScanResultsSheet({
  specimens,
  className,
  onRowSelect,
  selectedSpecimenId,
  variant = "table",
}: {
  specimens: ScanSpecimen[];
  className?: string;
  onRowSelect?: (specimenId: string) => void;
  selectedSpecimenId?: string | null;
  /** `mobile-list` — stacked rows with version prominent; `table` — desktop spreadsheet. */
  variant?: "table" | "mobile-list";
}) {
  const rows = useMemo(() => specimensToLiquidScanSheetRows(specimens), [specimens]);

  const copyCsv = async () => {
    const csv = liquidScanSheetRowsToCsv(rows);
    try {
      await navigator.clipboard.writeText(csv);
    } catch {
      /* fallback below */
    }
  };

  const downloadCsv = () => {
    const csv = liquidScanSheetRowsToCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `pgt-liquid-scan-sheet-${timestampSlug()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (specimens.length === 0) return null;

  return (
    <div className={cn("sc-scan-sheet sc-glow-border overflow-hidden rounded-xl sc-glass-raised", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/8 bg-white/[0.02] px-3 py-2">
        <div className="flex items-center gap-2">
          <Table2 className="h-3.5 w-3.5 text-emerald-400/90" aria-hidden />
          <div>
            <p className="text-[11px] font-semibold text-slate-100">Scan sheet</p>
            <p className="text-[10px] text-slate-500">
              {rows.length} row{rows.length === 1 ? "" : "s"} · edition &amp; FMV per card
            </p>
          </div>
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => void copyCsv()}
            className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] font-medium text-slate-400 transition hover:bg-white/5 hover:text-slate-200 touch-manipulation"
          >
            <Copy className="h-3 w-3" />
            Copy
          </button>
          <button
            type="button"
            onClick={downloadCsv}
            className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1.5 text-[10px] font-medium text-emerald-200/90 transition hover:bg-emerald-500/15 touch-manipulation"
          >
            <Download className="h-3 w-3" />
            CSV
          </button>
        </div>
      </div>

      {variant === "mobile-list" ? (
        <div className="max-h-[min(62dvh,28rem)] overflow-y-auto px-3 py-2 scanner-chat-scrollbar">
          <ScanResultsMobileList
            specimens={specimens}
            onRowSelect={onRowSelect}
            selectedSpecimenId={selectedSpecimenId}
          />
        </div>
      ) : (
        <div className="sc-scan-sheet-scroll overflow-x-auto scanner-chat-scrollbar">
          <table className="sc-scan-table w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-white/10 bg-[rgb(12,16,22)]">
                {LIQUID_SCAN_SHEET_COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    className={cn(
                      "sc-scan-th sticky top-0 z-[1] whitespace-nowrap px-2 py-2 text-[9px] font-semibold uppercase tracking-wider text-slate-500",
                      col.key === "row" && "sc-scan-sticky-col sc-scan-sticky-col-0",
                      col.key === "name" && "sc-scan-sticky-col sc-scan-sticky-col-1",
                      col.key === "version" && "sc-scan-sticky-col sc-scan-sticky-col-2",
                      col.align === "right" ? "text-right" : "text-left",
                    )}
                    style={{ minWidth: col.minWidth }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const specimen = specimens[i];
                const selected = specimen && selectedSpecimenId === specimen.id;
                return (
                  <tr
                    key={specimen?.id ?? row.row}
                    className={cn(
                      "border-b border-white/[0.04] transition-colors",
                      i % 2 === 0 ? "bg-white/[0.015]" : "bg-transparent",
                      selected && "bg-emerald-500/8",
                      onRowSelect && specimen && "cursor-pointer hover:bg-white/[0.04]",
                    )}
                    onClick={() => {
                      if (specimen && onRowSelect) onRowSelect(specimen.id);
                    }}
                  >
                    {LIQUID_SCAN_SHEET_COLUMNS.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          "max-w-[14rem] truncate px-2 py-1.5 text-[11px] text-slate-300",
                          col.key === "row" && "sc-scan-sticky-col sc-scan-sticky-col-0 font-mono text-slate-500",
                          col.key === "name" && "sc-scan-sticky-col sc-scan-sticky-col-1 font-medium text-slate-100",
                          col.key === "version" &&
                            "sc-scan-sticky-col sc-scan-sticky-col-2 font-medium text-violet-200/95",
                          (col.key === "sticker" || col.key === "fairMarketValue") &&
                            "font-mono tabular-nums",
                          col.key === "fairMarketValue" && "text-emerald-300/95",
                          col.key === "sticker" && "text-amber-200/90",
                          col.align === "right" && "text-right",
                        )}
                        title={String(row[col.key])}
                      >
                        {row[col.key]}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="border-t border-white/6 px-3 py-2 text-[10px] text-slate-600">
        {variant === "mobile-list"
          ? "Tap a row to open market details · Copy or download CSV for Excel"
          : "Scroll horizontally · Version column stays pinned on mobile"}
      </p>
    </div>
  );
}
