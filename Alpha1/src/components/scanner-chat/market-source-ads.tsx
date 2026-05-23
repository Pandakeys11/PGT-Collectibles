"use client";

import { ExternalLink } from "lucide-react";
import type { MarketSourceBrand } from "@/lib/scan/specimen-market-view";
import { cn } from "@/lib/cn";

export function MarketSourceAds({
  sources,
  className,
}: {
  sources: MarketSourceBrand[];
  className?: string;
}) {
  if (sources.length === 0) return null;

  const sold = sources.filter((s) => s.lane === "sold");
  const listed = sources.filter((s) => s.lane === "active");

  return (
    <section className={cn("min-w-0 w-full space-y-3", className)}>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Shop & research
        </p>
        <p className="text-[10px] text-slate-500">
          Ad-style shortcuts to live listings and sold searches for this card
        </p>
      </div>

      {listed.length > 0 ? (
        <div>
          <p className="mb-1.5 text-[9px] font-medium uppercase tracking-wider text-slate-600">
            Listed now
          </p>
          <div className="grid w-full min-w-0 grid-cols-2 gap-1.5">
            {listed.map((source) => (
              <SourceAdCard key={source.id} source={source} compact />
            ))}
          </div>
        </div>
      ) : null}

      {sold.length > 0 ? (
        <div>
          <p className="mb-1.5 text-[9px] font-medium uppercase tracking-wider text-slate-600">
            Sold & comps
          </p>
          <div className="grid grid-cols-2 gap-2">
            {sold.map((source) => (
              <SourceAdCard key={source.id} source={source} compact />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function SourceAdCard({
  source,
  compact = false,
}: {
  source: MarketSourceBrand;
  compact?: boolean;
}) {
  const isEbay = /ebay/i.test(source.label);
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "group block shrink-0 overflow-hidden rounded-xl border transition hover:ring-1 hover:ring-white/20",
        "min-w-0 w-full",
        isEbay
          ? "border-rose-500/25 bg-gradient-to-br from-[#e53238]/20 via-rose-950/40 to-slate-950/90"
          : "border-white/10 bg-gradient-to-br from-white/[0.06] to-slate-950/80",
      )}
    >
      <div className={cn("p-2.5", compact && "p-2")}>
        <div className="flex items-start justify-between gap-2">
          <span
            className="text-[11px] font-bold text-white"
            style={isEbay ? { color: "#ffb4b4" } : undefined}
          >
            {source.label}
          </span>
          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-white/50 group-hover:text-white/80" aria-hidden />
        </div>
        <p className="mt-1 text-[10px] leading-snug text-slate-300/90">{source.tagline}</p>
        <p className="mt-2 text-[9px] font-semibold uppercase tracking-wide text-emerald-400/90">
          {source.lane === "sold" ? "View sold results" : "Browse listings"}
        </p>
      </div>
    </a>
  );
}
