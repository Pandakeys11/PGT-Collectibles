"use client";

import { Info, Loader2, Newspaper, RefreshCw } from "lucide-react";
import { LiquidAskMarkdown } from "@/components/scanner-chat/liquid-ask-markdown";
import { useMarketDailyBrief } from "@/hooks/use-market-daily-brief";
import type { MarketDailyBriefPayload } from "@/lib/market/run-market-daily-brief";
import { cn } from "@/lib/cn";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function providerLabel(provider: MarketDailyBriefPayload["provider"]): string | null {
  if (provider === "gemini") return "Live web brief via Gemini Google Search";
  if (provider === "groq") return "Live web brief via Groq Compound search";
  if (provider === "openrouter") return "Pro open-web brief";
  if (provider === "pgt-only") return "PGT catalog desk (web brief unavailable)";
  return null;
}

export function MarketDailyBriefPanel({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { data, loading, error, reload } = useMarketDailyBrief();

  if (loading && !data) {
    return (
      <div
        className={cn(
          "sc-intel-daily-brief flex items-center gap-2 rounded-xl border border-violet-500/20 bg-violet-500/[0.06] px-3 py-2.5 text-[10px] text-muted",
          className,
        )}
      >
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-violet-400" aria-hidden />
        Loading today&apos;s TCG desk…
      </div>
    );
  }

  if (!data?.markdown && error) {
    return (
      <button
        type="button"
        onClick={() => void reload()}
        className={cn(
          "sc-intel-daily-brief w-full rounded-xl border border-dashed border-violet-500/25 bg-violet-500/[0.04] px-3 py-2.5 text-left text-[10px] text-violet-200/80 transition hover:border-violet-400/40 hover:bg-violet-500/10",
          className,
        )}
      >
        <span className="font-semibold text-violet-100">Daily TCG desk</span>
        <span className="mt-0.5 block text-muted">{error} · Tap to retry</span>
      </button>
    );
  }

  if (!data?.markdown) return null;

  const provider = providerLabel(data.provider);

  return (
    <section
      className={cn(
        "sc-intel-daily-brief min-w-0 rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-500/[0.08] via-transparent to-transparent",
        className,
      )}
      aria-label="Daily Pokémon TCG market desk"
    >
      <div className="border-b border-violet-500/15 px-3 py-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 ring-1 ring-violet-400/20">
              <Newspaper className="h-3.5 w-3.5 text-violet-300" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-300/90">
                Daily TCG desk
              </p>
              <p className="truncate text-[10px] text-slate-500">
                Desk {data.editionKey ?? data.todayUtc}
                {data.nextRefreshAt
                  ? ` · next ${formatDate(data.nextRefreshAt)}`
                  : ` · ${formatDate(data.researchedAt)}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void reload()}
            disabled={loading}
            className="shrink-0 rounded-lg p-1 text-slate-500 transition hover:bg-white/5 hover:text-slate-300 disabled:opacity-50"
            aria-label="Refresh daily brief"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden />
          </button>
        </div>
      </div>

      <div className="space-y-2 px-3 py-2.5">
        <div className="rounded-lg border border-sky-500/15 bg-sky-500/[0.04] px-2.5 py-2">
          <div className="flex gap-2">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-400" aria-hidden />
            <div className="min-w-0 space-y-0.5 text-[10px] leading-relaxed text-slate-400">
              <p className="font-medium text-sky-100/90">
                Market intelligence · {data.todayUtc}
              </p>
              {provider ? <p className="text-sky-200/80">{provider}</p> : null}
              {data.error ? <p className="text-amber-200/80">{data.error}</p> : null}
            </div>
          </div>
        </div>

        <div
          className={cn(
            "max-h-[min(28rem,50vh)] overflow-y-auto pr-0.5",
            compact && "max-h-[min(18rem,40vh)]",
          )}
        >
          <LiquidAskMarkdown text={data.markdown} className="text-[11px]" />
        </div>
      </div>
    </section>
  );
}
