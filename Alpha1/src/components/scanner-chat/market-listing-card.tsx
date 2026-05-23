"use client";

import { ExternalLink, Gavel, ShoppingBag, Tag } from "lucide-react";
import { inferMarketVenueType } from "@/lib/market/market-intelligence";
import {
  formatMarketDate,
  formatMarketUsd,
  gradeBadgeForItem,
  resolveListingUrl,
} from "@/lib/scan/specimen-market-view";
import type { ExtractedCard, MarketEvidence } from "@/lib/scan/schemas";
import type { buildEbayGradeHubs, buildHubUrlMap } from "@/lib/market/sources";
import { cn } from "@/lib/cn";

function sourceLabel(source: string | null | undefined): string {
  const s = (source ?? "Market").trim();
  if (/ebay/i.test(s)) return "eBay";
  if (/tcgplayer/i.test(s)) return "TCGPlayer";
  if (/cardmarket/i.test(s)) return "Cardmarket";
  if (/pricecharting/i.test(s)) return "PriceCharting";
  if (/pwcc|goldin|heritage/i.test(s)) return "Auction";
  return s.length > 18 ? `${s.slice(0, 16)}…` : s;
}

function sourceAccent(source: string | null | undefined): string {
  if (/ebay/i.test(source ?? "")) return "from-[#e53238]/20 to-rose-950/40 border-rose-500/25";
  if (/tcgplayer/i.test(source ?? "")) return "from-sky-500/15 to-slate-950/50 border-sky-500/20";
  if (/cardmarket/i.test(source ?? "")) return "from-indigo-500/15 to-slate-950/50 border-indigo-500/25";
  if (/pwcc|goldin|heritage|auction/i.test(`${source ?? ""}`)) return "from-amber-500/15 to-slate-950/50 border-amber-500/25";
  return "from-white/[0.06] to-slate-950/50 border-white/10";
}

export function MarketListingCard({
  item,
  hubMap,
  ebayGradeHubs,
  variant = "listing",
  layout = "carousel",
  card,
}: {
  item: MarketEvidence;
  hubMap: ReturnType<typeof buildHubUrlMap>;
  ebayGradeHubs: ReturnType<typeof buildEbayGradeHubs>;
  variant?: "listing" | "sold" | "auction";
  /** carousel = horizontal strip tile; fill = full-width stack in narrow rails */
  layout?: "carousel" | "fill";
  card?: ExtractedCard | null;
}) {
  const href = resolveListingUrl(item, hubMap, ebayGradeHubs, card);
  const venue = inferMarketVenueType(item);
  const isAuction = variant === "auction" || venue === "auction";
  const isSold = variant === "sold" || item.kind === "sold";
  const grade = gradeBadgeForItem(item);

  const Icon = isAuction ? Gavel : isSold ? Tag : ShoppingBag;
  const cta = isSold ? "View sale" : isAuction ? "View auction" : "View listing";
  const priceLabel = isSold ? "Sold for" : isAuction ? "Current bid / ask" : "Listed at";

  const body = (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border bg-gradient-to-br p-3 transition hover:ring-1 hover:ring-emerald-500/30",
        layout === "fill"
          ? "w-full min-w-0 max-w-none shrink"
          : "min-w-[11.5rem] max-w-[14rem] shrink-0",
        sourceAccent(item.source),
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex items-center gap-1 rounded-md bg-black/35 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-200">
          <Icon className="h-3 w-3 shrink-0" aria-hidden />
          {sourceLabel(item.source)}
        </span>
        {item.slab ? (
          <span className="max-w-[5rem] truncate rounded bg-white/10 px-1 py-0.5 font-mono text-[9px] text-amber-100/95">
            {item.slab}
          </span>
        ) : null}
      </div>

      <p className="mt-2 line-clamp-3 min-h-[2.75rem] text-[11px] leading-snug text-slate-100">
        {item.title}
      </p>

      <div className="mt-auto pt-3">
        <p className="text-[9px] uppercase tracking-wider text-slate-500">{priceLabel}</p>
        <p className="font-mono text-lg font-semibold tabular-nums text-emerald-300">
          {formatMarketUsd(item.priceUsd)}
        </p>
        <p className="mt-0.5 text-[10px] text-slate-500">
          {formatMarketDate(item.observedAt)}
          {grade !== "Raw" ? ` · ${grade}` : ""}
        </p>
      </div>

      {href ? (
        <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-300/90 group-hover:text-emerald-200">
          {cta}
          <ExternalLink className="h-3 w-3" aria-hidden />
        </span>
      ) : (
        <span className="mt-2 text-[10px] text-slate-600">No link</span>
      )}
    </article>
  );

  if (!href) return body;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50",
        layout === "fill" ? "w-full min-w-0" : "shrink-0",
      )}
    >
      {body}
    </a>
  );
}
