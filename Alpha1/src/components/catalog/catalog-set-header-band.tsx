"use client";

import { Loader2 } from "lucide-react";
import { CatalogChaseCardTile } from "@/components/catalog/catalog-chase-card-tile";
import { CatalogSetSealedFmvPanel } from "@/components/catalog/catalog-set-sealed-fmv-panel";
import { useSetInsight } from "@/hooks/use-set-insight";
import {
  CATALOG_CARD_SORT_OPTIONS,
  type CatalogCardSortId,
} from "@/lib/catalog/catalog-card-sort";
import { cn } from "@/lib/cn";

function fmtUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${Math.round(n).toLocaleString()}`;
}

export function CatalogSetHeaderBand({
  setId,
  setName,
  cardSort,
  onCardSortChange,
  onSelectChase,
  className,
}: {
  setId: string;
  setName: string;
  cardSort: CatalogCardSortId;
  onCardSortChange: (sort: CatalogCardSortId) => void;
  onSelectChase?: (catalogId: string) => void;
  className?: string;
}) {
  const { insight, loading } = useSetInsight(setId, setName);

  const chase = insight?.chaseCard ?? insight?.topValue?.[0] ?? null;

  return (
    <div
      className={cn(
        "sc-catalog-set-header-band rounded-xl border border-amber-500/20 bg-gradient-to-r from-amber-500/[0.06] via-black/20 to-transparent px-2.5 py-2 sm:px-3",
        className,
      )}
    >
      <div className="sc-catalog-set-header-band__top flex items-end justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[8px] font-semibold uppercase tracking-wide text-faint">Set catalog sum</p>
          {loading && !insight ? (
            <Loader2 className="mt-1 h-4 w-4 animate-spin text-amber-300/80" aria-hidden />
          ) : (
            <>
              <p className="font-mono text-lg font-semibold leading-tight text-amber-200">
                {fmtUsd(insight?.setWide?.tcgPlayerSumUsd)}
              </p>
              <p className="text-[9px] text-muted">
                {insight?.setWide?.pricedSlots ?? 0} priced · {insight?.setWide?.pricedPct ?? 0}%
              </p>
            </>
          )}
        </div>

        <div className="flex shrink-0 flex-col justify-center gap-1">
          <label
            className="text-[8px] font-semibold uppercase tracking-wide text-faint"
            htmlFor={`catalog-card-sort-${setId}`}
          >
            Sort
          </label>
          <select
            id={`catalog-card-sort-${setId}`}
            value={cardSort}
            onChange={(e) => onCardSortChange(e.target.value as CatalogCardSortId)}
            className="h-8 min-w-[6.5rem] rounded-lg border border-white/10 bg-black/40 px-2 text-[11px] text-primary"
          >
            {CATALOG_CARD_SORT_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {chase ? (
        <CatalogChaseCardTile
          card={chase}
          chaseSku={insight?.chaseSku}
          onSelect={onSelectChase}
          className="mt-2 w-full"
        />
      ) : null}

      <CatalogSetSealedFmvPanel
        setId={setId}
        setName={setName}
        sealedProducts={insight?.sealedProducts}
        loading={loading}
        className="mt-2 border-t border-white/6 pt-2"
      />
    </div>
  );
}
