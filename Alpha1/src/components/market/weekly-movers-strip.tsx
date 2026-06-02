"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { marketPokemonHref } from "@/lib/app-routes";
import {
  MarketMoversFootnote,
  MarketMoversSectionHeader,
} from "@/components/market/market-movers-explainer";
import type { WeeklyMoverCard, WeeklyMoversPayload } from "@/lib/market/weekly-movers-types";
import { MarketCardThumb } from "@/components/ui/market-card-thumb";
import { cn } from "@/lib/cn";

function fmtUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${Math.round(n).toLocaleString()}`;
}

function MoverRow({ row, up }: { row: WeeklyMoverCard; up: boolean }) {
  return (
    <Link
      href={marketPokemonHref(row.catalogId)}
      className="flex items-center gap-2 rounded-lg border border-transparent px-1.5 py-1 transition hover:border-white/10 hover:bg-white/[0.04] touch-manipulation"
    >
      <div className="h-9 w-7 shrink-0 overflow-hidden rounded bg-black/35 ring-1 ring-white/10">
        <MarketCardThumb src={row.imageUrl} className="p-0.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-[10px] font-medium text-primary">{row.name}</p>
        <p className="text-[8px] text-muted">
          {row.setName}
          {row.cardNumber ? ` · #${row.cardNumber}` : ""}
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
    </Link>
  );
}

export function WeeklyMoversStrip({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const [payload, setPayload] = useState<WeeklyMoversPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/market/weekly-movers", { credentials: "same-origin" });
      const body = (await res.json()) as WeeklyMoversPayload;
      setPayload(body);
    } catch {
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !payload) {
    return (
      <div className={cn("flex items-center justify-center gap-2 py-4 text-[10px] text-muted", className)}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Loading 7-day movers…
      </div>
    );
  }

  if (!payload?.ready) return null;

  return (
    <section
      className={cn("sc-weekly-movers rounded-xl border border-white/8 bg-black/20", className)}
      aria-label="Weekly price movers"
    >
      <header className="border-b border-white/8 px-2.5 py-2">
        <MarketMoversSectionHeader />
      </header>
      <div
        className={cn(
          "grid gap-2 p-2",
          compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2",
        )}
      >
        <div>
          <p className="mb-1 px-1 text-[8px] font-semibold uppercase tracking-wide text-emerald-300/90">
            Top increases
          </p>
          {payload.increases.length === 0 ? (
            <p className="px-1 text-[9px] text-muted">None flagged this week.</p>
          ) : (
            <div className="space-y-0.5">
              {payload.increases.map((row) => (
                <MoverRow key={`up-${row.catalogId}`} row={row} up />
              ))}
            </div>
          )}
        </div>
        <div>
          <p className="mb-1 px-1 text-[8px] font-semibold uppercase tracking-wide text-rose-300/90">
            Top decreases
          </p>
          {payload.decreases.length === 0 ? (
            <p className="px-1 text-[9px] text-muted">None flagged this week.</p>
          ) : (
            <div className="space-y-0.5">
              {payload.decreases.map((row) => (
                <MoverRow key={`dn-${row.catalogId}`} row={row} up={false} />
              ))}
            </div>
          )}
        </div>
      </div>
      <MarketMoversFootnote
        className="border-t border-white/8 px-2.5 py-2"
        usCount={payload.momentumUsCount}
        euCount={payload.momentumEuCount}
      />
    </section>
  );
}
