"use client";

import { useCallback, useEffect, useState } from "react";
import { Crown, Loader2 } from "lucide-react";
import type { CatalogSetInsightPayload } from "@/lib/catalog/set-insight-payload";
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
  const [insight, setInsight] = useState<CatalogSetInsightPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/catalog/set-insight?setId=${encodeURIComponent(setId)}`, {
        credentials: "same-origin",
      });
      const body = (await res.json()) as CatalogSetInsightPayload;
      if (body.setWide?.cardCount) setInsight(body);
      else setInsight(null);
    } catch {
      setInsight(null);
    } finally {
      setLoading(false);
    }
  }, [setId]);

  useEffect(() => {
    void load();
  }, [load]);

  const chase = insight?.chaseCard ?? insight?.topValue?.[0] ?? null;

  return (
    <div
      className={cn(
        "sc-catalog-set-header-band flex flex-wrap items-stretch gap-2 rounded-xl border border-amber-500/20 bg-gradient-to-r from-amber-500/[0.06] via-black/20 to-transparent px-2.5 py-2 sm:gap-3 sm:px-3",
        className,
      )}
    >
      <div className="flex min-w-[7rem] flex-1 flex-col justify-center sm:min-w-[9rem]">
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

      {chase ? (
        <button
          type="button"
          onClick={() => chase.catalogId && onSelectChase?.(chase.catalogId)}
          disabled={!chase.catalogId || !onSelectChase}
          className={cn(
            "flex min-w-0 flex-[2] items-center gap-2 rounded-lg border border-amber-400/25 bg-black/25 px-2 py-1.5 text-left transition",
            chase.catalogId && onSelectChase && "hover:border-amber-400/45 hover:bg-black/35",
          )}
        >
          <div className="h-12 w-9 shrink-0 overflow-hidden rounded-md bg-black/40 ring-1 ring-amber-400/20">
            {chase.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={chase.imageUrl} alt="" className="h-full w-full object-contain p-0.5" />
            ) : (
              <div className="flex h-full items-center justify-center">
                <Crown className="h-4 w-4 text-amber-400/60" aria-hidden />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[8px] font-semibold uppercase tracking-wide text-amber-300/90">Chase card</p>
            <p className="line-clamp-1 text-[11px] font-semibold text-primary">{chase.name}</p>
            <p className="text-[9px] text-muted">
              {chase.number ? `#${chase.number}` : "—"}
              {insight?.chaseSku ? ` · ${insight.chaseSku}` : ""}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-mono text-sm font-semibold text-amber-100">{fmtUsd(chase.priceUsd)}</p>
            {chase.priceLabel ? (
              <p className="text-[8px] text-faint">{chase.priceLabel}</p>
            ) : null}
          </div>
        </button>
      ) : null}

      <div className="flex shrink-0 flex-col justify-center gap-1">
        <label className="text-[8px] font-semibold uppercase tracking-wide text-faint" htmlFor="catalog-card-sort">
          Sort
        </label>
        <select
          id="catalog-card-sort"
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
  );
}
