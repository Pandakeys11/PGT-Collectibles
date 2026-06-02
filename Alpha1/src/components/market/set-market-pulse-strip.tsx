"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { topMomentumCards, type SetInsightCardSource } from "@/lib/catalog/set-insight-utils";
import type { SetInsightPriceCard } from "@/lib/catalog/set-insight-payload";
import { momentumSourceShort } from "@/lib/market/catalog-momentum";
import {
  SET_INSIGHT_MOVER_SEED_LIMIT,
  SET_MOVER_COLUMN_SIZE,
} from "@/lib/catalog/set-insight-limits";
import { weeklyMoversPayloadFromInsight } from "@/lib/market/set-insight-movers";
import {
  moversSignalSubtitle,
  type WeeklyMoverCard,
  type WeeklyMoversPayload,
} from "@/lib/market/weekly-movers-types";
import {
  MarketMoversFootnote,
  MarketMoversSectionHeader,
} from "@/components/market/market-movers-explainer";
import { MarketCardThumb } from "@/components/ui/market-card-thumb";
import { cn } from "@/lib/cn";

function fmtUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${Math.round(n).toLocaleString()}`;
}

function hasMoverRows(payload: WeeklyMoversPayload | null): boolean {
  return Boolean(payload?.ready && (payload.increases.length > 0 || payload.decreases.length > 0));
}

function clientPayloadFromCards(
  setName: string,
  cards: SetInsightCardSource[],
  columnSize: number,
): WeeklyMoversPayload | null {
  const seeds: SetInsightPriceCard[] = topMomentumCards(cards, SET_INSIGHT_MOVER_SEED_LIMIT).map(
    (r) => ({
      catalogId: r.catalogId,
      name: r.name,
      number: r.number,
      rarity: r.rarity,
      imageUrl: r.imageUrl,
      priceUsd: r.priceUsd,
      priceLabel: r.priceLabel,
      momentumPct: r.momentumPct,
      momentumLabel: r.momentumLabel,
      momentumDeltaUsd: r.momentumDeltaUsd,
      momentumRegion: r.momentumRegion,
    }),
  );
  return weeklyMoversPayloadFromInsight(setName, seeds, columnSize);
}

function MoverRow({
  row,
  up,
  onSelect,
}: {
  row: WeeklyMoverCard;
  up: boolean;
  onSelect?: (catalogId: string) => void;
}) {
  const region = row.momentumRegion ?? momentumSourceShort(row.momentumLabel);
  const inner = (
    <>
      <div className="h-9 w-7 shrink-0 overflow-hidden rounded bg-black/35 ring-1 ring-white/10">
        <MarketCardThumb src={row.imageUrl} className="p-0.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-[10px] font-medium text-primary">{row.name}</p>
        <p className="text-[8px] text-muted">
          {row.cardNumber ? `#${row.cardNumber}` : "—"}
          {row.rarity ? ` · ${row.rarity}` : ""}
          {region ? (
            <span
              className={cn(
                "ml-1 rounded px-1 py-px font-semibold uppercase tracking-wide",
                region === "US"
                  ? "bg-emerald-500/15 text-emerald-200/90"
                  : "bg-violet-500/15 text-violet-200/90",
              )}
            >
              {region}
            </span>
          ) : null}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-mono text-[10px] text-amber-200/90">{fmtUsd(row.priceUsd)}</p>
        <p className="text-[7px] text-muted">{row.priceLabel ?? "TCGPlayer"}</p>
        <p
          className={cn(
            "inline-flex items-center gap-0.5 font-mono text-[9px] font-semibold",
            up ? "text-emerald-300" : "text-rose-300",
          )}
          title={row.momentumLabel ?? "7d vs 30d median change"}
        >
          {up ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
          {row.momentumPct > 0 ? "+" : ""}
          {row.momentumPct}%
        </p>
      </div>
    </>
  );

  if (onSelect) {
    return (
      <button
        type="button"
        onClick={() => onSelect(row.catalogId)}
        className="flex w-full items-center gap-2 rounded-lg border border-transparent px-1.5 py-1 text-left transition hover:border-sky-500/25 hover:bg-white/[0.04] touch-manipulation"
      >
        {inner}
      </button>
    );
  }

  return <div className="flex items-center gap-2 px-1.5 py-1">{inner}</div>;
}

/** Set-scoped 7-day movers — refetches when `setId` changes (master catalog market pulse). */
export function SetMarketPulseStrip({
  setId,
  setName,
  cards,
  onSelectCard,
  compact = false,
  embeddedInRail = false,
  flow = false,
  seedMomentum,
  moverColumnSize = SET_MOVER_COLUMN_SIZE,
  className,
}: {
  setId: string;
  setName: string;
  /** In-view cards for instant preview while full-set movers load. */
  cards?: SetInsightCardSource[];
  onSelectCard?: (catalogId: string) => void;
  compact?: boolean;
  /** Inside CatalogMarketIntelligenceRail — parent supplies section chrome. */
  embeddedInRail?: boolean;
  /** Flat layout inside unified binder insight panel (no extra bordered shell). */
  flow?: boolean;
  /** Set-insight momentum rows when /api/market/set-movers has no Cardmarket signal yet. */
  seedMomentum?: SetInsightPriceCard[];
  /** Max rows per trending up / down column (default 5 in binder, 8 in full rail). */
  moverColumnSize?: number;
  className?: string;
}) {
  const [payload, setPayload] = useState<WeeklyMoversPayload | null>(null);
  const [loading, setLoading] = useState(false);

  const seedPayload = useMemo(
    () =>
      seedMomentum?.length
        ? weeklyMoversPayloadFromInsight(setName, seedMomentum, moverColumnSize)
        : null,
    [seedMomentum, setName, moverColumnSize],
  );

  const preview = useMemo(() => {
    if (seedPayload) return seedPayload;
    return cards?.length ? clientPayloadFromCards(setName, cards, moverColumnSize) : null;
  }, [cards, setName, seedPayload, moverColumnSize]);

  useEffect(() => {
    setPayload(null);
  }, [setId]);

  useEffect(() => {
    if (seedPayload) {
      setPayload((prev) => (hasMoverRows(prev) ? prev : seedPayload));
      return;
    }
    if (!cards?.length) return;
    const instant = clientPayloadFromCards(setName, cards, moverColumnSize);
    if (!instant) return;
    setPayload((prev) => (hasMoverRows(prev) ? prev : instant));
  }, [cards, setName, moverColumnSize, seedPayload]);

  useEffect(() => {
    if (!setId.trim()) {
      setPayload(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const q = new URLSearchParams({ setId, setName });
        const res = await fetch(`/api/market/set-movers?${q}`, { credentials: "same-origin" });
        const body = (await res.json()) as WeeklyMoversPayload;
        if (!cancelled) {
          setPayload((prev) => {
            if (hasMoverRows(body)) return body;
            if (hasMoverRows(seedPayload)) return seedPayload!;
            const local = cards?.length
              ? clientPayloadFromCards(setName, cards, moverColumnSize)
              : null;
            if (hasMoverRows(local)) return local!;
            return hasMoverRows(prev) ? prev : body.ready ? body : prev;
          });
        }
      } catch {
        if (!cancelled) {
          setPayload((prev) => {
            if (hasMoverRows(seedPayload)) return seedPayload!;
            const local = cards?.length
              ? clientPayloadFromCards(setName, cards, moverColumnSize)
              : null;
            if (hasMoverRows(local)) return local!;
            return prev;
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [setId, setName, cards, seedPayload, moverColumnSize]);

  const display = payload ?? preview;
  const signalSubtitle = moversSignalSubtitle(display?.signalKind);
  const showLoading = loading && !display?.ready;

  if (!setId.trim()) return null;

  if (showLoading) {
    return (
      <div
        className={cn(
          "flex items-center justify-center gap-2 py-3 text-[10px] text-muted",
          !embeddedInRail && "rounded-xl border border-sky-500/15 bg-sky-500/[0.04]",
          className,
        )}
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-300/80" aria-hidden />
        Loading {setName} movers…
      </div>
    );
  }

  if (!display?.ready) {
    return (
      <div
        className={cn(
          "px-1 py-2 text-[10px] text-muted",
          !embeddedInRail && !flow && "rounded-xl border border-white/8 bg-black/20 px-2.5",
          className,
        )}
      >
        No cards moved ±3% vs their 30-day median in this set yet. With PokeTrace configured you get US
        TCGPlayer/eBay trends; otherwise EU Cardmarket averages are used when available.
      </div>
    );
  }

  const grid = (
    <div
      className={cn(
        "grid gap-2",
        embeddedInRail ? "p-0" : "p-2",
        compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2",
      )}
    >
        <div>
          <p className="mb-1 px-1 text-[8px] font-semibold uppercase tracking-wide text-emerald-300/90">
            Trending up
          </p>
          {display.increases.length === 0 ? (
            <p className="px-1 text-[9px] text-muted">None flagged.</p>
          ) : (
            <div className="space-y-0.5">
              {display.increases.map((row) => (
                <MoverRow
                  key={`up-${row.catalogId}`}
                  row={row}
                  up
                  onSelect={onSelectCard}
                />
              ))}
            </div>
          )}
        </div>
        <div>
          <p className="mb-1 px-1 text-[8px] font-semibold uppercase tracking-wide text-rose-300/90">
            Trending down
          </p>
          {display.decreases.length === 0 ? (
            <p className="px-1 text-[9px] text-muted">None flagged.</p>
          ) : (
            <div className="space-y-0.5">
              {display.decreases.map((row) => (
                <MoverRow
                  key={`dn-${row.catalogId}`}
                  row={row}
                  up={false}
                  onSelect={onSelectCard}
                />
              ))}
            </div>
          )}
        </div>
    </div>
  );

  const footnote = (
    <MarketMoversFootnote
      className={embeddedInRail || flow ? "mt-2 px-1" : "border-t border-sky-500/10 px-2.5 py-2"}
      usCount={display.momentumUsCount}
      euCount={display.momentumEuCount}
    />
  );

  if (embeddedInRail || flow) {
    return (
      <div className={cn("sc-set-market-pulse", className)} aria-label={`${setName} 7-day movers`}>
        {signalSubtitle ? (
          <p className="mb-1.5 px-0.5 text-[8px] leading-snug text-muted/90">{signalSubtitle}</p>
        ) : null}
        {grid}
        {footnote}
      </div>
    );
  }

  return (
    <section
      className={cn("sc-set-market-pulse rounded-xl border border-sky-500/20 bg-sky-500/[0.04]", className)}
      aria-label={`${setName} 7-day market movers`}
    >
      <header className="border-b border-sky-500/15 px-2.5 py-2">
        <MarketMoversSectionHeader subtitle={signalSubtitle} />
        <p className="mt-0.5 truncate text-[8px] text-muted/80">{setName}</p>
      </header>
      {grid}
      {footnote}
    </section>
  );
}
