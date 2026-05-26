"use client";

import { LayoutGrid, Table2 } from "lucide-react";
import { cn } from "@/lib/cn";

export type ScanResultsView = "cards" | "sheet";

export function ScanResultsViewToggle({
  view,
  onViewChange,
  cardCount,
  className,
}: {
  view: ScanResultsView;
  onViewChange: (view: ScanResultsView) => void;
  cardCount: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex rounded-full border border-white/8 bg-black/30 p-0.5",
        className,
      )}
      role="tablist"
      aria-label="Scan results view"
    >
      <button
        type="button"
        role="tab"
        aria-selected={view === "cards"}
        onClick={() => onViewChange("cards")}
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium transition",
          view === "cards"
            ? "bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-500/30"
            : "text-slate-500 hover:text-slate-300",
        )}
      >
        <LayoutGrid className="h-3 w-3" />
        Cards ({cardCount})
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={view === "sheet"}
        onClick={() => onViewChange("sheet")}
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium transition",
          view === "sheet"
            ? "bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-500/30"
            : "text-slate-500 hover:text-slate-300",
        )}
      >
        <Table2 className="h-3 w-3" />
        Sheet ({cardCount})
      </button>
    </div>
  );
}
