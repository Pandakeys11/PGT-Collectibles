"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CatalogSetTile,
  type CatalogSetTileDensity,
  type CatalogSetTileModel,
} from "@/components/catalog/catalog-set-tile";
import {
  CATALOG_SET_GRID_BROWSE,
  CATALOG_SET_GRID_FULL,
  CATALOG_SET_GRID_SIDEBAR,
} from "@/lib/catalog/catalog-grid-layout";
import { cn } from "@/lib/cn";

function gridClassForDensity(density: CatalogSetTileDensity): string {
  switch (density) {
    case "sidebar":
      return CATALOG_SET_GRID_SIDEBAR;
    case "full":
      return CATALOG_SET_GRID_FULL;
    case "browse":
    default:
      return CATALOG_SET_GRID_BROWSE;
  }
}

export function CatalogSetTileGrid({
  sets,
  selectedSetId,
  onSelect,
  loading,
  error,
  emptyMessage = "No sets match this filter.",
  density = "browse",
  /** @deprecated Use density="sidebar" */
  compact = false,
  className,
  page,
  totalPages,
  totalCount,
  onPrevPage,
  onNextPage,
  pagingDisabled,
}: {
  sets: CatalogSetTileModel[];
  selectedSetId?: string | null;
  onSelect: (set: CatalogSetTileModel) => void;
  loading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  density?: CatalogSetTileDensity;
  compact?: boolean;
  className?: string;
  page?: number;
  totalPages?: number;
  totalCount?: number;
  onPrevPage?: () => void;
  onNextPage?: () => void;
  pagingDisabled?: boolean;
}) {
  const resolvedDensity: CatalogSetTileDensity = compact ? "sidebar" : density;

  if (loading) {
    return (
      <div className="flex h-full min-h-[12rem] flex-col items-center justify-center gap-2 py-12 text-sm text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin text-amber-300/80" aria-hidden />
        Loading sets…
      </div>
    );
  }

  if (error) {
    return <p className="p-4 text-sm text-red-300">{error}</p>;
  }

  if (sets.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-white/12 bg-white/[0.02] px-4 py-10 text-center text-xs leading-relaxed text-slate-500">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className={cn("flex h-full min-h-0 flex-col overflow-hidden", className)}>
      <div
        className={cn(
          "sc-catalog-set-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain pr-0.5 scanner-chat-scrollbar touch-pan-y",
        )}
      >
        <div className={cn("sc-catalog-set-grid grid content-start pb-2", gridClassForDensity(resolvedDensity))}>
          {sets.map((set) => (
            <CatalogSetTile
              key={set.id}
              set={set}
              selected={selectedSetId === set.id}
              onSelect={() => onSelect(set)}
              density={resolvedDensity}
            />
          ))}
        </div>
      </div>

      {page != null && totalPages != null && totalCount != null && onPrevPage && onNextPage ? (
        <div className="mt-2 flex shrink-0 items-center justify-between gap-2 border-t border-white/8 bg-[rgb(8,10,14)]/90 pt-2 text-[10px] text-slate-500 lg:text-xs">
          <span className="min-w-0 truncate">
            Page {page} / {totalPages} · {totalCount.toLocaleString()} sets
          </span>
          <div className="flex gap-1">
            <Button type="button" size="sm" variant="secondary" disabled={page <= 1 || pagingDisabled} onClick={onPrevPage}>
              Prev
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={page >= totalPages || pagingDisabled}
              onClick={onNextPage}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
