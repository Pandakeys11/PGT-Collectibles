"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { topMomentumCards, type SetInsightCardSource } from "@/lib/catalog/set-insight-utils";
import type { SetInsightPriceCard } from "@/lib/catalog/set-insight-payload";
import type { WeeklyMoverCard, WeeklyMoversPayload } from "@/lib/market/build-weekly-movers";
import { MarketCardThumb } from "@/components/ui/market-card-thumb";
import { cn } from "@/lib/cn";

function fmtUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${Math.round(n).toLocaleString()}`;
}

function payloadFromInsightMomentum(
  setName: string,
  rows: SetInsightPriceCard[],
): WeeklyMoversPayload | null {
  const mapped: WeeklyMoverCard[] = rows
    .filter((r) => r.momentumPct != null && r.momentumPct !== 0 && r.catalogId)
    .map((r) => ({
      catalogId: r.catalogId!,
      name: r.name,
      setName,
      setCode: null,
      cardNumber: r.number ?? null,
      rarity: r.rarity ?? null,
      imageUrl: r.imageUrl ?? null,
      priceUsd: r.priceUsd ?? null,
      momentumPct: r.momentumPct ?? 0,
      deltaUsd: null,
    }));
  if (!mapped.length) return null;
  const increases = mapped.filter((r) => r.momentumPct > 0).slice(0, 6);
  const decreases = mapped.filter((r) => r.momentumPct < 0).slice(0, 6);
  if (!increases.length && !decreases.length) return null;
  return {
    ready: true,
    refreshedAt: new Date().toISOString(),
    increases,
    decreases,
  };
}

function clientPayloadFromCards(
  setName: string,
  cards: SetInsightCardSource[],
): WeeklyMoversPayload | null {
  const rows: WeeklyMoverCard[] = topMomentumCards(cards, 12).map((r) => ({
    catalogId: r.catalogId,
    name: r.name,
    setName,
    setCode: null,
    cardNumber: r.number,
    rarity: r.rarity,
    imageUrl: r.imageUrl,
    priceUsd: r.priceUsd,
    momentumPct: r.momentumPct ?? 0,
    deltaUsd: null,
  }));
  if (rows.length === 0) return null;
  const increases = rows.filter((r) => r.momentumPct > 0).slice(0, 6);
  const decreases = rows.filter((r) => r.momentumPct < 0).slice(0, 6);
  if (increases.length === 0 && decreases.length === 0) return null;
  return {
    ready: true,
    refreshedAt: new Date().toISOString(),
    increases,
    decreases,
  };
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
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-mono text-[10px] text-amber-200/90">{fmtUsd(row.priceUsd)}</p>
        <p
          className={cn(
            "inline-flex items-center gap-0.5 font-mono text-[9px] font-semibold",
            up ? "text-emerald-300" : "text-rose-300",
          )}
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
  className?: string;
}) {
  const [payload, setPayload] = useState<WeeklyMoversPayload | null>(null);
  const [loading, setLoading] = useState(false);

  const seedPayload = useMemo(
    () => (seedMomentum?.length ? payloadFromInsightMomentum(setName, seedMomentum) : null),
    [seedMomentum, setName],
  );

  const preview = useMemo(() => {
    if (seedPayload) return seedPayload;
    return cards?.length ? clientPayloadFromCards(setName, cards) : null;
  }, [cards, setName, seedPayload]);

  useEffect(() => {
    setPayload(null);
  }, [setId]);

  useEffect(() => {
    if (!cards?.length) return;
    const instant = clientPayloadFromCards(setName, cards);
    if (!instant) return;
    setPayload((prev) => {
      if (prev?.ready && (prev.increases.length > 0 || prev.decreases.length > 0)) {
        return prev;
      }
      return instant;
    });
  }, [cards, setName]);

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
            if (body.ready) return body;
            const local =
              seedPayload ??
              (cards?.length ? clientPayloadFromCards(setName, cards) : null);
            return local ?? prev;
          });
        }
      } catch {
        if (!cancelled) {
          setPayload((prev) => {
            const local =
              seedPayload ??
              (cards?.length ? clientPayloadFromCards(setName, cards) : null);
            return local ?? prev;
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [setId, setName, cards, seedPayload]);

  const display = payload ?? preview;
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
        No 7-day movers flagged yet — Cardmarket trend data may be sparse for this set; check back after
        catalog sync.
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

  if (embeddedInRail || flow) {
    return (
      <div className={cn("sc-set-market-pulse", className)} aria-label={`${setName} 7-day movers`}>
        {grid}
      </div>
    );
  }

  return (
    <section
      className={cn("sc-set-market-pulse rounded-xl border border-sky-500/20 bg-sky-500/[0.04]", className)}
      aria-label={`${setName} 7-day market movers`}
    >
      <header className="border-b border-sky-500/15 px-2.5 py-2">
        <p className="text-[9px] font-semibold uppercase tracking-wide text-sky-200/90">
          7-day market movers
        </p>
        <p className="truncate text-[8px] text-muted">
          {setName} · Cardmarket trend vs 7-day avg
        </p>
      </header>
      {grid}
    </section>
  );
}
