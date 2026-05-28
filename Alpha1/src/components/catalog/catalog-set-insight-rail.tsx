"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ExternalLink,
  Loader2,
  RefreshCw,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { rollupSetInsightCards, type SetInsightCardSource } from "@/lib/catalog/set-insight-utils";
import type {
  CatalogSetInsightPayload,
  SetInsightPriceCard,
} from "@/lib/catalog/set-insight-payload";
import { cn } from "@/lib/cn";

function fmtUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${Math.round(n).toLocaleString()}`;
}

function InsightCardRow({
  row,
  onClick,
  trailing,
}: {
  row: SetInsightPriceCard;
  onClick?: () => void;
  trailing?: ReactNode;
}) {
  const inner = (
    <>
      <div className="h-11 w-8 shrink-0 overflow-hidden rounded-md bg-black/30 ring-1 ring-white/10">
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
        {row.note ? (
          <p className="line-clamp-1 text-[8px] text-faint">{row.note}</p>
        ) : null}
      </div>
      <div className="shrink-0 text-right">{trailing}</div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-2 rounded-lg border border-transparent px-1.5 py-1.5 text-left transition hover:border-amber-500/25 hover:bg-white/[0.04] touch-manipulation"
      >
        {inner}
      </button>
    );
  }

  return <div className="flex items-center gap-2 px-1.5 py-1.5">{inner}</div>;
}

export function CatalogSetInsightRail({
  setId,
  setName,
  cards,
  onSelectCard,
  className,
}: {
  setId: string;
  setName: string;
  cards: SetInsightCardSource[];
  onSelectCard?: (catalogId: string) => void;
  className?: string;
}) {
  const [insight, setInsight] = useState<CatalogSetInsightPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const inViewRollup = useMemo(() => rollupSetInsightCards(cards), [cards]);
  const inViewPct =
    inViewRollup.cardCount > 0
      ? Math.round((100 * inViewRollup.pricedSlots) / inViewRollup.cardCount)
      : 0;

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
        const pricedFromApi = (body.setWide?.pricedSlots ?? 0) > 0;
        const pricedInView = inViewRollup.pricedSlots > 0;
        if (!body.ready && !pricedFromApi && !pricedInView) {
          throw new Error(
            body.error === "insight_empty"
              ? "No prices loaded for this set — confirm POKEMON_TCG_API_KEY and run catalog sync."
              : body.error ?? "Set insight unavailable",
          );
        }
        setInsight(
          body.ready
            ? body
            : {
                ...body,
                ready: true,
                summary:
                  body.summary ??
                  (pricedFromApi
                    ? `${setName}: ${body.setWide.pricedSlots} of ${body.setWide.cardCount} cards priced from catalog.`
                    : `${inViewRollup.pricedSlots} of ${inViewRollup.cardCount} visible cards priced in this filter.`),
                setWide: pricedFromApi
                  ? body.setWide
                  : {
                      cardCount: inViewRollup.cardCount,
                      tcgPlayerSumUsd: inViewRollup.tcgPlayerSumUsd,
                      pricedSlots: inViewRollup.pricedSlots,
                      pricedPct: inViewPct,
                    },
              },
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load set insight");
        setInsight(null);
      } finally {
        setLoading(false);
      }
    },
    [setId, setName, inViewRollup, inViewPct],
  );

  useEffect(() => {
    setInsight(null);
    void load(false);
  }, [load]);

  const setWide = insight?.setWide;
  const topValue = insight?.topValue ?? [];
  const momentum = insight?.momentum ?? [];
  const promos = insight?.promos ?? [];
  const sealed = insight?.sealedProducts ?? [];

  return (
    <aside
      className={cn(
        "sc-catalog-set-insight-rail desk-surface-raised flex min-h-0 flex-col overflow-hidden border border-white/8 sc-glass-raised",
        className,
      )}
      aria-label={`${setName} set insight`}
    >
      <header className="shrink-0 border-b border-white/8 bg-gradient-to-r from-amber-500/[0.08] to-transparent px-3 py-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-amber-300" aria-hidden />
            <div className="min-w-0">
              <h3 className="truncate text-xs font-semibold text-primary">Set insight</h3>
              <p className="truncate text-[10px] text-muted">{setName}</p>
            </div>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => void load(true)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-white/5 hover:text-primary disabled:opacity-50"
            aria-label="Refresh set insight"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </button>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <div className="rounded-lg border border-white/8 bg-black/25 px-2 py-1.5">
            <p className="text-[8px] font-semibold uppercase tracking-wide text-faint">Set catalog sum</p>
            <p className="font-mono text-sm font-semibold text-amber-200">
              {fmtUsd(setWide?.tcgPlayerSumUsd ?? inViewRollup.tcgPlayerSumUsd)}
            </p>
            <p className="text-[9px] text-muted">
              {setWide?.pricedSlots ?? inViewRollup.pricedSlots} priced ·{" "}
              {setWide?.pricedPct ?? inViewPct}%
            </p>
          </div>
          <div className="rounded-lg border border-white/8 bg-black/25 px-2 py-1.5">
            <p className="text-[8px] font-semibold uppercase tracking-wide text-faint">In view</p>
            <p className="font-mono text-sm font-semibold text-primary">{inViewRollup.cardCount}</p>
            <p className="text-[9px] text-muted">cards this filter</p>
          </div>
        </div>
      </header>

      <div className="sc-catalog-set-insight-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2 scanner-chat-scrollbar">
        {loading && !insight ? (
          <div className="flex flex-col items-center justify-center gap-2 px-2 py-8 text-center">
            <Loader2 className="h-5 w-5 animate-spin text-amber-300" aria-hidden />
            <p className="text-[11px] text-muted">Researching {setName}…</p>
            <p className="text-[9px] text-faint">AI web research + catalog merge</p>
          </div>
        ) : error && !insight ? (
          <div className="flex flex-col items-center gap-2 px-2 py-6 text-center">
            <p className="text-[11px] text-rose-300">{error}</p>
            <button
              type="button"
              onClick={() => void load(true)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-medium text-primary"
            >
              Retry
            </button>
          </div>
        ) : insight ? (
          <>
            {insight.summary ? (
              <section className="mb-3">
                <p className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-2.5 py-2 text-[10px] leading-relaxed text-amber-100/95">
                  {insight.summary}
                </p>
                {insight.marketPulse ? (
                  <p className="mt-1.5 px-1 text-[9px] leading-snug text-muted">{insight.marketPulse}</p>
                ) : null}
                {insight.model ? (
                  <p className="mt-1 px-1 text-[8px] text-faint">
                    Source: {insight.source} · {insight.model}
                  </p>
                ) : null}
              </section>
            ) : null}

            {insight.chaseNotes ? (
              <section className="mb-3">
                <p className="px-1 text-[9px] font-semibold uppercase tracking-wide text-faint">Chase & demand</p>
                <p className="mt-1 rounded-lg border border-white/8 bg-black/20 px-2 py-1.5 text-[10px] leading-snug text-primary/90">
                  {insight.chaseNotes}
                </p>
              </section>
            ) : null}

            <section className="mb-3">
              <p className="px-1 text-[9px] font-semibold uppercase tracking-wide text-faint">Highest value</p>
              {topValue.length === 0 ? (
                <p className="px-1 py-2 text-[10px] text-muted">No priced chase cards found yet.</p>
              ) : (
                <div className="mt-1 space-y-0.5">
                  {topValue.map((row) => (
                    <InsightCardRow
                      key={`${row.catalogId ?? row.name}-${row.number ?? ""}`}
                      row={row}
                      onClick={
                        row.catalogId && onSelectCard
                          ? () => onSelectCard(row.catalogId!)
                          : undefined
                      }
                      trailing={
                        <div className="text-right">
                          <span className="font-mono text-[11px] font-medium text-amber-200">
                            {fmtUsd(row.priceUsd)}
                          </span>
                          {row.priceLabel ? (
                            <p className="text-[8px] text-faint">{row.priceLabel}</p>
                          ) : null}
                        </div>
                      }
                    />
                  ))}
                </div>
              )}
            </section>

            <section className="mb-3">
              <p className="px-1 text-[9px] font-semibold uppercase tracking-wide text-faint">Price momentum</p>
              <p className="px-1 text-[9px] text-muted">Recent move vs trailing avg (web + catalog)</p>
              {momentum.length === 0 ? (
                <p className="px-1 py-2 text-[10px] text-muted">No strong movers flagged.</p>
              ) : (
                <div className="mt-1 space-y-0.5">
                  {momentum.map((row) => {
                    const up = (row.momentumPct ?? 0) >= 0;
                    return (
                      <InsightCardRow
                        key={`mom-${row.catalogId ?? row.name}`}
                        row={row}
                        onClick={
                          row.catalogId && onSelectCard
                            ? () => onSelectCard(row.catalogId!)
                            : undefined
                        }
                        trailing={
                          <span
                            className={cn(
                              "inline-flex items-center gap-0.5 font-mono text-[10px] font-semibold",
                              up ? "text-emerald-300" : "text-rose-300",
                            )}
                          >
                            {row.momentumPct != null ? (
                              <>
                                {up ? (
                                  <TrendingUp className="h-3 w-3" aria-hidden />
                                ) : (
                                  <TrendingDown className="h-3 w-3" aria-hidden />
                                )}
                                {row.momentumPct > 0 ? "+" : ""}
                                {row.momentumPct}%
                              </>
                            ) : (
                              <span className="text-muted">{fmtUsd(row.priceUsd)}</span>
                            )}
                          </span>
                        }
                      />
                    );
                  })}
                </div>
              )}
            </section>

            {promos.length > 0 ? (
              <section className="mb-3">
                <p className="px-1 text-[9px] font-semibold uppercase tracking-wide text-faint">
                  Promos & specials
                </p>
                <div className="mt-1 space-y-0.5">
                  {promos.map((row) => (
                    <InsightCardRow
                      key={`promo-${row.catalogId ?? row.name}`}
                      row={row}
                      onClick={
                        row.catalogId && onSelectCard
                          ? () => onSelectCard(row.catalogId!)
                          : undefined
                      }
                      trailing={
                        <span className="font-mono text-[10px] text-muted">{fmtUsd(row.priceUsd)}</span>
                      }
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {sealed.length > 0 ? (
              <section className="mb-3">
                <p className="px-1 text-[9px] font-semibold uppercase tracking-wide text-faint">Sealed product</p>
                <ul className="mt-1 space-y-1.5">
                  {sealed.map((row, i) => (
                    <li
                      key={`${row.label}-${i}`}
                      className="rounded-lg border border-white/8 bg-black/20 px-2 py-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[10px] font-medium text-primary">{row.label}</p>
                        <span className="shrink-0 font-mono text-[10px] text-amber-200">
                          {fmtUsd(row.priceUsd)}
                        </span>
                      </div>
                      {row.priceLabel ? (
                        <p className="text-[8px] uppercase tracking-wide text-faint">{row.priceLabel}</p>
                      ) : null}
                      {row.note ? <p className="mt-0.5 text-[9px] text-muted">{row.note}</p> : null}
                      {row.searchUrl ? (
                        <a
                          href={row.searchUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-[9px] font-medium text-amber-300 hover:underline"
                        >
                          Market search
                          <ExternalLink className="h-2.5 w-2.5" aria-hidden />
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {insight.references.length > 0 ? (
              <section>
                <p className="px-1 text-[9px] font-semibold uppercase tracking-wide text-faint">Sources</p>
                <ul className="mt-1 space-y-1">
                  {insight.references.map((ref) => (
                    <li key={ref.url}>
                      <a
                        href={ref.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[9px] text-amber-300/90 hover:underline"
                      >
                        {ref.label}
                        <ExternalLink className="h-2.5 w-2.5" aria-hidden />
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </aside>
  );
}
