"use client";

import { ExternalLink, Gavel, ShoppingBag, Sparkles, Tag } from "lucide-react";
import { evidenceRowKey } from "@/lib/scan/comps-analytics";
import { classifyHeatmapLane, type HeatmapLaneId } from "@/lib/scan/market-heatmap";
import {
  formatMarketDate,
  formatMarketUsd,
  gradeBadgeForItem,
  isRecentSale,
  resolveListingUrl,
} from "@/lib/scan/specimen-market-view";
import type { ExtractedCard, MarketEvidence } from "@/lib/scan/schemas";
import { MarketSourceLogo } from "@/components/market/market-source-logo";
import { normalizeMarketSource, type buildEbayGradeHubs, type buildHubUrlMap } from "@/lib/market/sources";
import { cn } from "@/lib/cn";

const LANE_STYLE: Record<
  HeatmapLaneId,
  { border: string; badge: string; label: string; Icon: typeof Tag }
> = {
  sold: {
    border: "bg-emerald-500",
    badge: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/25",
    label: "Sold",
    Icon: Tag,
  },
  listed: {
    border: "bg-amber-400",
    badge: "bg-amber-500/15 text-amber-200 ring-amber-500/25",
    label: "Listed",
    Icon: ShoppingBag,
  },
  auction: {
    border: "bg-violet-400",
    badge: "bg-violet-500/15 text-violet-200 ring-violet-500/25",
    label: "Auction",
    Icon: Gavel,
  },
  premium: {
    border: "bg-rose-400",
    badge: "bg-rose-500/15 text-rose-200 ring-rose-500/25",
    label: "Premium",
    Icon: Sparkles,
  },
};

export function MarketEvidenceRow({
  item,
  hubMap,
  ebayGradeHubs,
  card,
  excluded,
  outlier,
  onToggleExclude,
  showLatestBadge,
}: {
  item: MarketEvidence;
  hubMap: ReturnType<typeof buildHubUrlMap>;
  ebayGradeHubs: ReturnType<typeof buildEbayGradeHubs>;
  card?: ExtractedCard | null;
  excluded?: boolean;
  outlier?: boolean;
  onToggleExclude?: () => void;
  showLatestBadge?: boolean;
}) {
  const lane = classifyHeatmapLane(item) ?? (item.kind === "sold" ? "sold" : "listed");
  const style = LANE_STYLE[lane];
  const Icon = style.Icon;
  const href = resolveListingUrl(item, hubMap, ebayGradeHubs, card);
  const recent = item.kind === "sold" && isRecentSale(item);
  const priceLabel = item.kind === "sold" ? "Sold" : lane === "auction" ? "Auction" : "Ask";

  return (
    <article
      className={cn(
        "relative flex gap-2 rounded-lg border border-white/8 bg-white/[0.03] py-2 pl-2.5 pr-2",
        excluded && "opacity-45",
        outlier && !excluded && "border-rose-500/25 bg-rose-500/5",
      )}
    >
      <span className={cn("absolute left-0 top-2 bottom-2 w-0.5 rounded-full", style.border)} aria-hidden />

      {onToggleExclude ? (
        <input
          type="checkbox"
          checked={!excluded}
          aria-label="Include in adjusted FMV"
          className="mt-2 h-3.5 w-3.5 shrink-0 accent-emerald-500"
          onChange={onToggleExclude}
        />
      ) : null}

      <div className="min-w-0 flex-1 py-0.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-mono text-base font-semibold tabular-nums text-emerald-300">
              {formatMarketUsd(item.priceUsd)}
            </p>
            <p className="text-[9px] uppercase tracking-wide text-slate-500">{priceLabel}</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1">
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[9px] font-semibold ring-1",
                style.badge,
              )}
            >
              <Icon className="h-2.5 w-2.5" aria-hidden />
              {style.label}
            </span>
            {recent ? (
              <span className="rounded bg-emerald-500/15 px-1 py-0.5 text-[8px] font-medium text-emerald-300">
                Recent
              </span>
            ) : null}
            {showLatestBadge ? (
              <span className="text-[8px] font-medium text-emerald-400/90">Latest</span>
            ) : null}
            {outlier ? (
              <span className="text-[8px] font-medium text-rose-400">Outlier</span>
            ) : null}
          </div>
        </div>

        <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-slate-200">{item.title}</p>

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
          <span>{formatMarketDate(item.observedAt)}</span>
          <span className="text-slate-600">·</span>
          {item.source ? (
            <MarketSourceLogo
              label={item.source}
              sourceId={normalizeMarketSource(item.source)}
              variant="compact"
            />
          ) : (
            <span>Source</span>
          )}
          {item.slab ? (
            <>
              <span className="text-slate-600">·</span>
              <span className="font-mono text-amber-200/90">{item.slab}</span>
            </>
          ) : (
            <>
              <span className="text-slate-600">·</span>
              <span>{gradeBadgeForItem(item)}</span>
            </>
          )}
        </div>
      </div>

      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="mt-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition hover:border-emerald-500/30 hover:text-emerald-300"
          aria-label="Open source"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      ) : null}
    </article>
  );
}

export function MarketEvidenceFeed({
  items,
  hubMap,
  ebayGradeHubs,
  card,
  excludedKeys,
  outlierKeys,
  onToggleExclude,
  maxRows = 6,
  emptyMessage,
  className,
}: {
  items: MarketEvidence[];
  hubMap: ReturnType<typeof buildHubUrlMap>;
  ebayGradeHubs: ReturnType<typeof buildEbayGradeHubs>;
  card?: ExtractedCard | null;
  excludedKeys?: Set<string>;
  outlierKeys?: Set<string>;
  onToggleExclude?: (key: string) => void;
  maxRows?: number;
  emptyMessage?: string;
  className?: string;
}) {
  const visible = items.slice(0, maxRows);

  if (visible.length === 0) {
    return (
      <p className={cn("rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-[11px] text-slate-500", className)}>
        {emptyMessage ?? "No comps in this filter."}
      </p>
    );
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      {visible.map((item, index) => {
        const key = evidenceRowKey(item);
        return (
          <MarketEvidenceRow
            key={key}
            item={item}
            hubMap={hubMap}
            ebayGradeHubs={ebayGradeHubs}
            card={card}
            excluded={excludedKeys?.has(key)}
            outlier={outlierKeys?.has(key)}
            onToggleExclude={onToggleExclude ? () => onToggleExclude(key) : undefined}
            showLatestBadge={index === 0 && item.kind === "sold"}
          />
        );
      })}
    </div>
  );
}
