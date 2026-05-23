"use client";

import { useEffect, useMemo, useState } from "react";
import { LineChart } from "lucide-react";
import type { ScanSpecimen } from "@/hooks/use-scan-session";
import { marketHistoryFetchKey } from "@/lib/market/history-fetch-key";
import { cn } from "@/lib/cn";

type MarketSnapshotRow = {
  id: string;
  grade_bucket: string;
  fmv_usd: number | string | null;
  fmv_basis: string | null;
  confidence: number | string | null;
  sold_count: number;
  active_count: number;
  auction_count: number;
  captured_at: string;
};

function money(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "-";
  return `$${Math.round(value).toLocaleString()}`;
}

function numeric(value: number | string | null): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function dateLabel(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

export function MarketHistoryPanel({
  specimen,
  refreshKey = 0,
  className,
}: {
  specimen: ScanSpecimen | null;
  /** Increment after save to reload FMV snapshots. */
  refreshKey?: number;
  className?: string;
}) {
  const [rows, setRows] = useState<MarketSnapshotRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchKey = useMemo(() => {
    if (!specimen) return null;
    return `${specimen.id}|${marketHistoryFetchKey(specimen.card)}|${refreshKey}`;
  }, [specimen, refreshKey]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!specimen || !fetchKey) {
        setRows([]);
        return;
      }
      setLoading(true);
      try {
        const response = await fetch("/api/scan/market-history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ card: specimen.card, limit: 30 }),
        });
        const payload = (await response.json().catch(() => ({}))) as {
          snapshots?: MarketSnapshotRow[];
        };
        if (!cancelled) setRows(response.ok ? (payload.snapshots ?? []) : []);
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [fetchKey, specimen]);

  const ordered = useMemo(() => [...rows].reverse(), [rows]);
  const points = ordered
    .map((row) => numeric(row.fmv_usd))
    .filter((value): value is number => value != null);
  const low = points.length ? Math.min(...points) : null;
  const high = points.length ? Math.max(...points) : null;
  const latest = rows[0] ?? null;
  const latestValue = latest ? numeric(latest.fmv_usd) : null;

  if (!specimen) return null;

  return (
    <section className={cn("min-w-0 rounded-xl border border-white/8 sc-glass-raised p-2.5", className)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Value history
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            {loading
              ? "Loading saved snapshots…"
              : rows.length
                ? `${rows.length} saved snapshot(s)`
                : "Save scans to build FMV history"}
          </p>
        </div>
        <LineChart className="h-4 w-4 text-emerald-400" />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-1.5">
        <div className="rounded-lg border border-white/8 bg-white/[0.03] p-2">
          <p className="text-[10px] uppercase text-slate-500">Latest</p>
          <p className="mt-1 font-mono text-sm text-slate-50">{money(latestValue)}</p>
        </div>
        <div className="rounded-lg border border-white/8 bg-white/[0.03] p-2">
          <p className="text-[10px] uppercase text-slate-500">Low</p>
          <p className="mt-1 font-mono text-sm text-slate-50">{money(low)}</p>
        </div>
        <div className="rounded-lg border border-white/8 bg-white/[0.03] p-2">
          <p className="text-[10px] uppercase text-slate-500">High</p>
          <p className="mt-1 font-mono text-sm text-slate-50">{money(high)}</p>
        </div>
      </div>

      {rows.length > 0 ? (
        <div className="mt-3 max-h-40 space-y-1.5 overflow-y-auto pr-1 scanner-chat-scrollbar">
          {rows.slice(0, 6).map((row) => (
            <div
              key={row.id}
              className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.03] px-2 py-1.5 text-xs"
            >
              <span className="min-w-0 truncate text-slate-400">
                {dateLabel(row.captured_at)} / {row.grade_bucket}
              </span>
              <span className="shrink-0 font-mono text-slate-100">{money(numeric(row.fmv_usd))}</span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
