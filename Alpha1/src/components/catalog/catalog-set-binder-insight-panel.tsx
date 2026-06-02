"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { CatalogChaseCardTile } from "@/components/catalog/catalog-chase-card-tile";
import { CatalogSetSealedFmvPanel } from "@/components/catalog/catalog-set-sealed-fmv-panel";
import { SetMarketPulseStrip } from "@/components/market/set-market-pulse-strip";
import {
  CATALOG_CARD_SORT_OPTIONS,
  type CatalogCardSortId,
} from "@/lib/catalog/catalog-card-sort";
import type { CatalogSetInsightPayload, SetInsightPriceCard } from "@/lib/catalog/set-insight-payload";
import type { SetInsightCardSource } from "@/lib/catalog/set-insight-utils";
import { cn } from "@/lib/cn";

function fmtUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${Math.round(n).toLocaleString()}`;
}

function ValueRow({
  row,
  onSelect,
}: {
  row: SetInsightPriceCard;
  onSelect?: (catalogId: string) => void;
}) {
  const inner = (
    <>
      <div className="h-10 w-7 shrink-0 overflow-hidden rounded bg-black/30 ring-1 ring-white/10">
        {row.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={row.imageUrl} alt="" className="h-full w-full object-contain p-0.5" />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-[11px] font-medium text-primary">{row.name}</p>
        <p className="text-[9px] text-muted">
          {row.number ? `#${row.number}` : "—"}
          {row.rarity ? ` · ${row.rarity}` : ""}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <span className="font-mono text-[11px] font-medium text-amber-200">{fmtUsd(row.priceUsd)}</span>
        {row.priceLabel ? <p className="text-[8px] text-faint">{row.priceLabel}</p> : null}
      </div>
    </>
  );

  if (onSelect && row.catalogId) {
    return (
      <button
        type="button"
        onClick={() => onSelect(row.catalogId!)}
        className="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left transition hover:bg-white/[0.04] touch-manipulation"
      >
        {inner}
      </button>
    );
  }

  return <div className="flex items-center gap-2 px-1 py-1">{inner}</div>;
}

/**
 * Flowing set insight column for master-catalog binder view — one scroll, no nested rail boxes.
 */
export function CatalogSetBinderInsightPanel({
  setId,
  setName,
  cards,
  cardSort,
  onCardSortChange,
  onSelectCard,
  onSelectChase,
  className,
}: {
  setId: string;
  setName: string;
  cards: SetInsightCardSource[];
  cardSort: CatalogCardSortId;
  onCardSortChange: (sort: CatalogCardSortId) => void;
  onSelectCard?: (catalogId: string) => void;
  onSelectChase?: (catalogId: string) => void;
  className?: string;
}) {
  const [insight, setInsight] = useState<CatalogSetInsightPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (refresh = false) => {
      setLoading(true);
      setError(null);
      try {
        const q = new URLSearchParams({ setId });
        if (refresh) q.set("refresh", "1");
        const res = await fetch(`/api/catalog/set-insight?${q}`, { credentials: "same-origin" });
        const body = (await res.json()) as CatalogSetInsightPayload & { error?: string };
        if (!res.ok) {
          throw new Error(body.error ?? `Request failed (${res.status})`);
        }
        if (!body.setWide?.cardCount && !body.ready) {
          throw new Error(body.error ?? "Set insight unavailable");
        }
        setInsight({ ...body, ready: true });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load set insight");
        setInsight(null);
      } finally {
        setLoading(false);
      }
    },
    [setId],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  const chase = insight?.chaseCard ?? insight?.topValue?.[0] ?? null;
  const topValue = useMemo(() => {
    const rows = insight?.topValue ?? [];
    if (!chase?.catalogId) return rows;
    return rows.filter((r) => r.catalogId !== chase.catalogId);
  }, [insight?.topValue, chase?.catalogId]);

  return (
    <div
      className={cn(
        "sc-catalog-binder-insight-flow rounded-xl border border-white/8 bg-gradient-to-b from-amber-500/[0.04] to-black/20 px-2.5 py-2.5 sm:px-3",
        className,
      )}
      aria-label={`${setName} set insight`}
    >
      <div className="flex items-start justify-between gap-2">
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

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            disabled={loading}
            onClick={() => void load(true)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition hover:bg-white/5 hover:text-primary disabled:opacity-50"
            aria-label="Refresh set insight"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </button>
          <div className="flex flex-col justify-center gap-0.5">
            <label
              className="text-[8px] font-semibold uppercase tracking-wide text-faint"
              htmlFor={`catalog-binder-sort-${setId}`}
            >
              Sort
            </label>
            <select
              id={`catalog-binder-sort-${setId}`}
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
      </div>

      {error && !insight ? (
        <p className="mt-2 text-[11px] text-rose-300">{error}</p>
      ) : null}

      {chase ? (
        <CatalogChaseCardTile
          card={chase}
          chaseSku={insight?.chaseSku}
          onSelect={onSelectChase}
          className="mt-2.5 w-full"
        />
      ) : null}

      <CatalogSetSealedFmvPanel
        setId={setId}
        setName={setName}
        sealedProducts={insight?.sealedProducts}
        loading={loading}
        className="mt-2.5 border-t border-white/6 pt-2.5"
      />

      <div className="mt-2.5 border-t border-white/6 pt-2.5">
        <p className="text-[9px] font-semibold uppercase tracking-wide text-sky-200/90">
          7-day market movers
        </p>
        <p className="mb-1 text-[8px] text-muted">Cardmarket trend vs 7-day avg</p>
        <SetMarketPulseStrip
          setId={setId}
          setName={setName}
          cards={cards}
          onSelectCard={onSelectCard}
          seedMomentum={insight?.momentum}
          flow
          compact
          embeddedInRail
        />
      </div>

      {insight?.summary ? (
        <p className="mt-2.5 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-2 py-1.5 text-[10px] leading-relaxed text-amber-100/95">
          {insight.summary}
        </p>
      ) : null}

      <div className="mt-2.5 border-t border-white/6 pt-2.5">
        <p className="text-[9px] font-semibold uppercase tracking-wide text-faint">Highest value</p>
        {topValue.length === 0 && !loading ? (
          <p className="py-1 text-[10px] text-muted">No additional priced cards yet.</p>
        ) : (
          <div className="mt-0.5 space-y-0.5">
            {topValue.slice(0, 8).map((row) => (
              <ValueRow
                key={`${row.catalogId ?? row.name}-${row.number ?? ""}`}
                row={row}
                onSelect={onSelectCard}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
