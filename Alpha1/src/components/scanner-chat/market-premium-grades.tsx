"use client";

import { ExternalLink, Sparkles } from "lucide-react";
import { resolveEvidenceExternalUrl } from "@/lib/market/sources";
import {
  formatMarketDate,
  formatMarketUsd,
  type GradeHighlightView,
} from "@/lib/scan/specimen-market-view";
import type { buildHubUrlMap } from "@/lib/market/sources";
import { cn } from "@/lib/cn";

const TIER_STYLE: Record<
  GradeHighlightView["bucket"],
  { ring: string; glow: string; badge: string }
> = {
  psa10: {
    ring: "border-red-500/30",
    glow: "from-red-500/12 to-slate-950/80",
    badge: "bg-red-500/20 text-red-100",
  },
  bgsBlackLabel: {
    ring: "border-slate-300/35",
    glow: "from-slate-200/10 to-slate-950/80",
    badge: "bg-slate-200/15 text-slate-100",
  },
  cgcPristine10: {
    ring: "border-sky-500/35",
    glow: "from-sky-500/12 to-slate-950/80",
    badge: "bg-sky-500/20 text-sky-100",
  },
  psa9: {
    ring: "border-red-500/20",
    glow: "from-red-500/8 to-slate-950/80",
    badge: "bg-red-500/15 text-red-100",
  },
};

/** Short labels so all three tiers fit in a ~380px intelligence rail. */
const SHORT_TITLE: Record<GradeHighlightView["bucket"], string> = {
  psa10: "PSA 10",
  psa9: "PSA 9",
  bgsBlackLabel: "BGS BL",
  cgcPristine10: "CGC P10",
};

function CompStat({
  label,
  price,
  date,
  href,
}: {
  label: string;
  price: string;
  date: string;
  href: string | null;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[8px] uppercase tracking-wide text-slate-600">{label}</p>
      <p className="truncate font-mono text-[10px] font-medium text-slate-100">{price}</p>
      <p className="truncate text-[8px] text-slate-500">{date}</p>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="mt-0.5 inline-flex items-center gap-0.5 text-[8px] font-medium text-emerald-400 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          Search
          <ExternalLink className="h-2 w-2 shrink-0" aria-hidden />
        </a>
      ) : null}
    </div>
  );
}

export function MarketPremiumGrades({
  rows,
  hubMap,
  className,
}: {
  rows: GradeHighlightView[];
  hubMap: ReturnType<typeof buildHubUrlMap>;
  className?: string;
}) {
  if (rows.length === 0) return null;

  return (
    <section className={cn("min-w-0 w-full space-y-2", className)}>
      <div className="flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-300" aria-hidden />
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Premium graded comps
          </p>
          <p className="truncate text-[9px] text-slate-500">PSA 10 · BGS BL · CGC Pristine 10</p>
        </div>
      </div>

      <div className="grid w-full min-w-0 grid-cols-3 gap-1.5">
        {rows.map((row) => {
          const style = TIER_STYLE[row.bucket];
          const soldUrl =
            row.ebayHub.sold?.trim() ||
            (row.latestSold
              ? resolveEvidenceExternalUrl(row.latestSold, hubMap, {
                  ebayGradeHub: row.ebayHub,
                })
              : null);
          const listedUrl =
            row.ebayHub.active?.trim() ||
            (row.latestListed
              ? resolveEvidenceExternalUrl(row.latestListed, hubMap, {
                  ebayGradeHub: row.ebayHub,
                })
              : null);

          const hasData =
            row.fmvUsd != null ||
            row.latestSold ||
            row.latestListed ||
            row.soldCount > 0 ||
            row.listedCount > 0;

          return (
            <div
              key={row.bucket}
              className={cn(
                "flex min-w-0 flex-col rounded-lg border bg-gradient-to-b p-2",
                style.ring,
                style.glow,
                !hasData && "opacity-70",
              )}
            >
              <div className="flex min-w-0 items-start justify-between gap-0.5">
                <span
                  className={cn(
                    "truncate rounded px-1 py-0.5 text-[8px] font-bold uppercase leading-tight",
                    style.badge,
                  )}
                  title={row.title}
                >
                  {SHORT_TITLE[row.bucket]}
                </span>
                <span className="shrink-0 font-mono text-[8px] text-slate-500">
                  {row.soldCount}s
                </span>
              </div>

              <p className="mt-1.5 font-mono text-base font-semibold leading-none tabular-nums text-emerald-300">
                {formatMarketUsd(row.fmvUsd)}
              </p>
              {row.fmvBasis ? (
                <p className="mt-0.5 truncate text-[8px] text-slate-500">
                  {row.fmvBasis.replace(/_/g, " ")}
                </p>
              ) : (
                <p className="mt-0.5 text-[8px] leading-tight text-slate-600">
                  No session FMV
                </p>
              )}

              <div className="mt-2 grid min-w-0 grid-cols-1 gap-1.5 border-t border-white/8 pt-1.5">
                <CompStat
                  label="Sold"
                  price={formatMarketUsd(row.latestSold?.priceUsd ?? null)}
                  date={formatMarketDate(row.latestSold?.observedAt)}
                  href={soldUrl}
                />
                <CompStat
                  label="Ask"
                  price={formatMarketUsd(row.latestListed?.priceUsd ?? null)}
                  date={formatMarketDate(row.latestListed?.observedAt)}
                  href={listedUrl}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
