"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CatalogSetTile, type CatalogSetTileModel } from "@/components/catalog/catalog-set-tile";
import { cn } from "@/lib/cn";

export function CatalogSetTileGrid({
  sets,
  selectedSetId,
  onSelect,
  loading,
  error,
  emptyMessage = "No sets match this filter.",
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
  compact?: boolean;
  className?: string;
  page?: number;
  totalPages?: number;
  totalCount?: number;
  onPrevPage?: () => void;
  onNextPage?: () => void;
  pagingDisabled?: boolean;
}) {
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
        <div
          className={cn(
            "sc-catalog-set-tile-grid grid content-start pb-2",
            compact
              ? "grid-cols-2 gap-2 max-lg:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3"
              : "grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4",
          )}
        >
          {sets.map((set) => (
            <CatalogSetTile
              key={set.id}
              set={set}
              selected={selectedSetId === set.id}
              onSelect={() => onSelect(set)}
              compact={compact}
              vault
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
