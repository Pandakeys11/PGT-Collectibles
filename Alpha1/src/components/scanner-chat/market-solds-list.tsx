"use client";

import { ExternalLink } from "lucide-react";
import { evidenceRowKey } from "@/lib/scan/comps-analytics";
import { buildEbayHubForCard } from "@/lib/market/sources";
import {
  formatMarketDate,
  formatMarketUsd,
  gradeBadgeForItem,
  isRecentSale,
  resolveListingUrl,
} from "@/lib/scan/specimen-market-view";
import type { ExtractedCard, MarketEvidence } from "@/lib/scan/schemas";
import type { buildEbayGradeHubs, buildHubUrlMap } from "@/lib/market/sources";
import { cn } from "@/lib/cn";

export function MarketSoldsList({
  items,
  hubMap,
  ebayGradeHubs,
  excludedKeys,
  outlierKeys,
  onToggleExclude,
  maxRows = 10,
  card,
  className,
}: {
  items: MarketEvidence[];
  hubMap: ReturnType<typeof buildHubUrlMap>;
  ebayGradeHubs: ReturnType<typeof buildEbayGradeHubs>;
  /** Scanned card — sold links open the same eBay sold search as Shop & research. */
  card?: ExtractedCard | null;
  excludedKeys?: Set<string>;
  outlierKeys?: Set<string>;
  onToggleExclude?: (key: string) => void;
  maxRows?: number;
  className?: string;
}) {
  const visible = items.slice(0, maxRows);

  if (visible.length === 0) {
    const ebaySold = card ? buildEbayHubForCard(card).sold : null;
    return (
      <div
        className={cn(
          "rounded-lg border border-dashed border-white/10 px-3 py-6 text-center text-xs text-slate-500",
          className,
        )}
      >
        <p>No sold comps in this filter yet.</p>
        {ebaySold ? (
          <a
            href={ebaySold}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1 font-medium text-emerald-400 hover:underline"
          >
            Open eBay sold search for this card
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        ) : (
          <p className="mt-1">Run enrich or use Shop &amp; research links above.</p>
        )}
      </div>
    );
  }

  return (
    <ul className={cn("space-y-2", className)}>
      {visible.map((item, index) => {
        const key = evidenceRowKey(item);
        const excluded = excludedKeys?.has(key) ?? false;
        const outlier = outlierKeys?.has(key) ?? false;
        const href = resolveListingUrl(item, hubMap, ebayGradeHubs, card);
        const recent = isRecentSale(item);

        return (
          <li
            key={key}
            className={cn(
              "relative rounded-xl border border-white/8 bg-white/[0.03] pl-3 pr-2 py-2.5",
              excluded && "opacity-45",
              outlier && !excluded && "border-rose-500/25 bg-rose-500/5",
            )}
          >
            <span
              className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-emerald-500/70"
              aria-hidden
            />
            <div className="flex gap-2">
              {onToggleExclude ? (
                <input
                  type="checkbox"
                  checked={!excluded}
                  aria-label="Include in adjusted FMV"
                  className="mt-1 h-3.5 w-3.5 shrink-0 accent-emerald-500"
                  onChange={() => onToggleExclude(key)}
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-mono text-base font-semibold tabular-nums text-emerald-300">
                    {formatMarketUsd(item.priceUsd)}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                    {recent ? (
                      <span className="rounded bg-emerald-500/15 px-1 py-0.5 font-medium text-emerald-300">
                        Recent
                      </span>
                    ) : null}
                    <span>{formatMarketDate(item.observedAt)}</span>
                    {outlier ? (
                      <span className="text-rose-400">Outlier</span>
                    ) : null}
                  </div>
                </div>
                <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-slate-200">
                  {item.title}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px]">
                  <span className="rounded bg-white/8 px-1.5 py-0.5 text-slate-400">
                    {item.source ?? "Source"}
                  </span>
                  {item.slab ? (
                    <span className="font-mono text-amber-200/90">{item.slab}</span>
                  ) : (
                    <span className="text-slate-500">{gradeBadgeForItem(item)}</span>
                  )}
                  {index === 0 ? (
                    <span className="font-medium text-emerald-400/90">Latest sold</span>
                  ) : null}
                </div>
              </div>
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition hover:border-emerald-500/30 hover:text-emerald-300"
                  aria-label="Open sale"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
