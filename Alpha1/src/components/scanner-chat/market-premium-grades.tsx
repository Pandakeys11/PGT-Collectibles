"use client";

import { useMemo } from "react";
import { ExternalLink, Loader2, MessageSquareText, Sparkles } from "lucide-react";
import { LiquidAskMarkdown } from "@/components/scanner-chat/liquid-ask-markdown";
import { resolveEvidenceExternalUrl } from "@/lib/market/sources";
import {
  formatMarketDate,
  formatMarketUsd,
  type GradeHighlightView,
} from "@/lib/scan/specimen-market-view";
import type { buildHubUrlMap } from "@/lib/market/sources";
import { buildPremiumGradesInsight } from "@/lib/scan/premium-grades-insight";
import { usePremiumGradeBrief } from "@/hooks/use-premium-grade-brief";
import type { ExtractedCard } from "@/lib/scan/schemas";
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
  card,
  specimenId,
  enriching = false,
  sessionCompCount = 0,
  marketAsOf,
  className,
}: {
  rows: GradeHighlightView[];
  hubMap: ReturnType<typeof buildHubUrlMap>;
  card?: Pick<ExtractedCard, "name" | "set" | "number" | "year" | "rarity" | "printStamps"> | null;
  specimenId?: string | null;
  enriching?: boolean;
  sessionCompCount?: number;
  marketAsOf?: string | null;
  className?: string;
}) {
  const sessionInsight = useMemo(
    () => (card && rows.length > 0 ? buildPremiumGradesInsight(card, rows) : null),
    [card, rows],
  );

  const webBrief = usePremiumGradeBrief(card ?? null, {
    specimenId,
    marketAsOf,
    enabled: Boolean(card?.name?.trim()) && rows.length > 0,
  });

  if (rows.length === 0) return null;

  const showSessionLines =
    sessionInsight && !sessionInsight.isEmpty && sessionCompCount > 0;

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
          const hubReady = Boolean(row.ebayHub.sold?.trim() || row.ebayHub.active?.trim());

          return (
            <div
              key={row.bucket}
              className={cn(
                "flex min-w-0 flex-col rounded-lg border bg-gradient-to-b p-2",
                style.ring,
                style.glow,
                !hasData && !hubReady && "opacity-70",
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
                  {hasData ? "FMV from session comps" : "No session FMV yet"}
                </p>
              )}

              <div className="mt-2 grid min-w-0 grid-cols-1 gap-1.5 border-t border-white/8 pt-1.5">
                <CompStat
                  label="Last sold"
                  price={formatMarketUsd(row.latestSold?.priceUsd ?? null)}
                  date={formatMarketDate(row.latestSold?.observedAt)}
                  href={soldUrl}
                />
                <CompStat
                  label="Live ask"
                  price={formatMarketUsd(row.latestListed?.priceUsd ?? null)}
                  date={formatMarketDate(row.latestListed?.observedAt)}
                  href={listedUrl}
                />
              </div>

              {!hasData && hubReady ? (
                <p className="mt-1.5 text-[8px] leading-snug text-slate-500">
                  No {row.title} comps in session — Search opens eBay for this grade.
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border border-violet-500/20 bg-violet-500/[0.06] px-2.5 py-2">
        <div className="flex items-start gap-2">
          <MessageSquareText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-300" aria-hidden />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-violet-200/80">
                Premium grade research
              </p>
              {webBrief.status === "ready" ? (
                <span className="text-[8px] text-slate-500">
                  {webBrief.provider === "gemini" ? "Gemini search" : "Web brief"} ·{" "}
                  {webBrief.todayUtc}
                </span>
              ) : null}
            </div>

            {sessionInsight ? (
              <p className="text-[11px] font-medium leading-snug text-slate-200">
                {sessionInsight.headline}
              </p>
            ) : null}

            {webBrief.status === "loading" || enriching ? (
              <p className="inline-flex items-center gap-2 text-[10px] text-slate-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" aria-hidden />
                Researching PSA 10, BGS Black Label, and CGC Pristine via live web search…
              </p>
            ) : null}

            {showSessionLines ? (
              <div className="space-y-1 rounded-md border border-white/6 bg-black/20 px-2 py-1.5">
                <p className="text-[8px] font-semibold uppercase tracking-wide text-slate-500">
                  From this scan
                </p>
                {sessionInsight.lines.map((line, i) => (
                  <p key={`sess-${i}`} className="text-[10px] leading-relaxed text-slate-400">
                    {line}
                  </p>
                ))}
              </div>
            ) : null}

            {webBrief.status === "ready" ? (
              <LiquidAskMarkdown
                text={webBrief.markdown}
                className="text-[10px] leading-relaxed text-slate-300 [&_strong]:text-slate-100"
              />
            ) : null}

            {webBrief.status === "unconfigured" ? (
              <p className="text-[10px] leading-relaxed text-amber-200/90">{webBrief.message}</p>
            ) : null}

            {webBrief.status === "error" ? (
              <p className="text-[10px] leading-relaxed text-rose-300/90">{webBrief.message}</p>
            ) : null}

            {webBrief.status === "idle" && !enriching ? (
              <p className="text-[10px] text-slate-500">Select a card to load premium grade research.</p>
            ) : null}
          </div>
        </div>
      </div>

      <p className="text-[9px] leading-snug text-slate-600">
        Tier tiles use session eBay comps when enrich has run. Research above auto-runs per card (same
        engine as Liquid Ask web brief).
      </p>
    </section>
  );
}
