"use client";

import { useMemo } from "react";
import { Copy, Download, Table2 } from "lucide-react";
import type { ScanSpecimen } from "@/hooks/use-scan-session";
import {
  LIQUID_SCAN_SHEET_COLUMNS,
  liquidScanSheetRowsToCsv,
  liquidScanSheetTableMinWidth,
  specimensToLiquidScanSheetRows,
} from "@/lib/scan/liquid-scan-sheet";
import { cn } from "@/lib/cn";

function timestampSlug() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function ScanSheetTable({
  rows,
  specimens,
  onRowSelect,
  selectedSpecimenId,
}: {
  rows: ReturnType<typeof specimensToLiquidScanSheetRows>;
  specimens: ScanSpecimen[];
  onRowSelect?: (specimenId: string) => void;
  selectedSpecimenId?: string | null;
}) {
  const tableMinWidth = liquidScanSheetTableMinWidth();

  return (
    <table
      className="sc-scan-table w-full border-collapse text-left"
      style={{ minWidth: tableMinWidth }}
    >
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
                    (col.key === "sticker" || col.key === "fairMarketValue") && "font-mono tabular-nums",
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
  );
}

export function ScanResultsSheet({
  specimens,
  className,
  onRowSelect,
  selectedSpecimenId,
  fillHeight = false,
}: {
  specimens: ScanSpecimen[];
  className?: string;
  onRowSelect?: (specimenId: string) => void;
  selectedSpecimenId?: string | null;
  /** Fill drawer / panel height; table scrolls inside. */
  fillHeight?: boolean;
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
    <div
      className={cn(
        "sc-scan-sheet sc-glow-border w-full min-w-0 max-w-full overflow-hidden rounded-xl sc-glass-raised",
        fillHeight && "sc-scan-sheet--fill flex min-h-0 flex-col",
        className,
      )}
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-white/8 bg-white/[0.02] px-3 py-2">
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

      <div
        className={cn(
          "sc-scan-sheet-scroll sc-scan-sheet-table-scroll relative min-h-0 scanner-chat-scrollbar",
          fillHeight ? "flex-1" : "max-h-[min(56dvh,28rem)] lg:max-h-[min(62dvh,32rem)]",
        )}
        role="region"
        aria-label="Scan sheet spreadsheet"
        tabIndex={0}
      >
        <ScanSheetTable
          rows={rows}
          specimens={specimens}
          onRowSelect={onRowSelect}
          selectedSpecimenId={selectedSpecimenId}
        />
      </div>

      <p className="shrink-0 border-t border-white/6 px-3 py-2 text-[10px] text-slate-600">
        Scroll horizontally and vertically · <span className="text-slate-500"># · Name · Version</span>{" "}
        stay pinned while you browse
      </p>
    </div>
  );
}
