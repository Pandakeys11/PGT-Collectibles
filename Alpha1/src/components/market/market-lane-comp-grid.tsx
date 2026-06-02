"use client";

import type { CatalogLaneCompSummary } from "@/lib/market/catalog-knowledge-lane-summary";
import { cn } from "@/lib/cn";

function laneTone(bucket: CatalogLaneCompSummary["bucket"]): string {
  if (bucket === "raw") return "border-emerald-500/25 bg-emerald-500/[0.06]";
  if (bucket === "psa9" || bucket === "psa10") return "border-violet-500/25 bg-violet-500/[0.06]";
  return "border-sky-500/20 bg-sky-500/[0.05]";
}

function LaneRow({ row }: { row: CatalogLaneCompSummary }) {
  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(3.5rem,auto)_1fr_1fr] items-center gap-x-2 gap-y-0.5 rounded-lg border px-2 py-1.5",
        laneTone(row.bucket),
      )}
    >
      <p className="text-[9px] font-semibold uppercase tracking-wide text-primary">{row.label}</p>
      <div className="min-w-0 text-center">
        <p className="text-[7px] font-semibold uppercase tracking-wider text-muted">Sold</p>
        <p className="font-mono text-[11px] font-medium tabular-nums text-accent">{row.soldDisplay}</p>
        {row.soldCount > 0 ? (
          <p className="text-[7px] text-faint">{row.soldCount} comp{row.soldCount === 1 ? "" : "s"}</p>
        ) : null}
      </div>
      <div className="min-w-0 text-center">
        <p className="text-[7px] font-semibold uppercase tracking-wider text-muted">Listed</p>
        <p className="font-mono text-[11px] font-medium tabular-nums text-sky-200/95">
          {row.listedDisplay}
        </p>
        {row.activeCount > 0 ? (
          <p className="text-[7px] text-faint">{row.activeCount} listing{row.activeCount === 1 ? "" : "s"}</p>
        ) : null}
      </div>
    </div>
  );
}

/** Uniform raw + graded sold/listed strip for catalog card market intel. */
export function MarketLaneCompGrid({
  lanes,
  className,
}: {
  lanes: CatalogLaneCompSummary[];
  className?: string;
}) {
  if (!lanes.length) return null;

  const raw = lanes.filter((r) => r.bucket === "raw");
  const graded = lanes.filter((r) => r.bucket !== "raw");

  return (
    <div className={cn("space-y-2", className)}>
      {raw.length > 0 ? (
        <div>
          <p className="mb-1 px-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-200/85">
            Raw market
          </p>
          <div className="space-y-1">
            {raw.map((row) => (
              <LaneRow key={row.bucket} row={row} />
            ))}
          </div>
        </div>
      ) : null}
      {graded.length > 0 ? (
        <div>
          <p className="mb-1 px-0.5 text-[9px] font-semibold uppercase tracking-wide text-violet-200/85">
            Graded market
          </p>
          <div className="space-y-1">
            {graded.map((row) => (
              <LaneRow key={row.bucket} row={row} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
