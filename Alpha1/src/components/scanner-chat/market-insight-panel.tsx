"use client";

import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/cn";

const SOURCES = [
  { name: "TCGPlayer", status: "live", latency: "1.2s" },
  { name: "eBay sold", status: "live", latency: "2.4s" },
  { name: "PriceCharting", status: "cached", latency: "—" },
  { name: "PWCC", status: "graded", latency: "3.1s" },
] as const;

export function MarketInsightPanel({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-white/6 sc-glass-raised p-4", className)}>
      <div className="mb-3 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-sky-400" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Market sources
        </h3>
      </div>
      <ul className="space-y-2">
        {SOURCES.map((s) => (
          <li
            key={s.name}
            className="flex items-center justify-between rounded-lg bg-white/[0.03] px-2.5 py-2"
          >
            <span className="text-xs text-slate-300">{s.name}</span>
            <span className="flex items-center gap-2 text-[10px] text-slate-600">
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5",
                  s.status === "live"
                    ? "bg-emerald-500/15 text-emerald-400"
                    : s.status === "graded"
                      ? "bg-sky-500/15 text-sky-400"
                      : "bg-white/5 text-slate-500",
                )}
              >
                {s.status}
              </span>
              {s.latency !== "—" ? s.latency : ""}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[10px] leading-relaxed text-slate-600">
        Comps refresh per scan. Values shown as ranges, not single points.
      </p>
    </div>
  );
}
