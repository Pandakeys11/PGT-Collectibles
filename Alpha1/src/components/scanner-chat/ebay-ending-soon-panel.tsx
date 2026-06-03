"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Gavel, Loader2, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEbayEndingSoon } from "@/hooks/use-ebay-ending-soon";
import {
  ebayAuctionUrgencyClass,
  formatEbayAuctionTimeLeft,
} from "@/lib/market/ebay-ending-soon-display";
import { ebayEndingSoonHubUrl } from "@/lib/market/ebay-ending-soon-feeds";
import type { EbayEndingSoonFeedId } from "@/lib/market/ebay-ending-soon-feeds";
import type { EbayEndingSoonListing } from "@/lib/market/ebay-ending-soon-types";
import { cn } from "@/lib/cn";

function fmtUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function FeedToggle({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-md px-2 py-1 text-[9px] font-semibold transition",
        active
          ? "bg-rose-500/25 text-rose-100 ring-1 ring-rose-400/40"
          : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200",
      )}
    >
      {label}
    </button>
  );
}

function AuctionCard({ listing, nowMs }: { listing: EbayEndingSoonListing; nowMs: number }) {
  const [imgFailed, setImgFailed] = useState(false);
  const timeLeft = formatEbayAuctionTimeLeft(listing.endsAt, nowMs);

  return (
    <a
      href={listing.url}
      target="_blank"
      rel="noreferrer"
      className="group flex min-w-0 gap-2.5 rounded-xl border border-rose-500/20 bg-gradient-to-br from-[#e53238]/10 via-rose-950/30 to-slate-950/80 p-2.5 transition hover:ring-1 hover:ring-rose-400/35"
    >
      <div className="h-[4.25rem] w-[3.25rem] shrink-0 overflow-hidden rounded-lg bg-black/40 ring-1 ring-white/10">
        {listing.imageUrl && !imgFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.imageUrl}
            alt=""
            className="h-full w-full object-contain p-0.5"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Gavel className="h-4 w-4 text-rose-300/60" aria-hidden />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[11px] leading-snug text-slate-100">{listing.title}</p>
        <div className="mt-1.5 flex flex-wrap items-end justify-between gap-1">
          <div>
            <p className="text-[9px] uppercase tracking-wide text-slate-500">Current bid</p>
            <p className="font-mono text-sm font-semibold tabular-nums text-emerald-300">
              {fmtUsd(listing.priceUsd)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[9px] uppercase tracking-wide text-slate-500">Time left</p>
            <p
              className={cn(
                "font-mono text-xs font-semibold tabular-nums",
                ebayAuctionUrgencyClass(listing.endsAt, nowMs),
              )}
            >
              {timeLeft.primary}
            </p>
            <p className="font-mono text-[9px] tabular-nums text-slate-500" title={listing.endsAt}>
              {timeLeft.endsAtLabel}
            </p>
            {listing.bidCount != null ? (
              <p className="text-[9px] text-slate-500">
                {listing.bidCount} bid{listing.bidCount === 1 ? "" : "s"}
              </p>
            ) : null}
          </div>
        </div>
        <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-rose-200/90 group-hover:text-rose-100">
          View on eBay
          <ExternalLink className="h-3 w-3" aria-hidden />
        </span>
      </div>
    </a>
  );
}

export function EbayEndingSoonPanel({
  onDismiss,
  className,
}: {
  onDismiss?: () => void;
  className?: string;
}) {
  const feed = useEbayEndingSoon();
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const listings = useMemo(
    () =>
      [...feed.listings].sort((a, b) => Date.parse(a.endsAt) - Date.parse(b.endsAt)),
    [feed.listings],
  );

  const fetchedLabel = feed.payload?.fetchedAt
    ? new Date(feed.payload.fetchedAt).toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  const hubUrl =
    feed.payload?.hubUrl ?? ebayEndingSoonHubUrl(feed.activeFeed);

  return (
    <div className={cn("sc-ebay-ending-panel flex min-w-0 flex-col", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-rose-500/20 bg-rose-500/[0.07] px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Gavel className="h-4 w-4 shrink-0 text-rose-300" aria-hidden />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-200/95">
              eBay ending soon
            </p>
            <p className="truncate text-[10px] text-slate-500">
              {feed.activeFeed.label} · US auctions · live Browse API
              {fetchedLabel ? ` · ${fetchedLabel}` : ""}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-muted"
            disabled={feed.loading}
            onClick={() => void feed.reload()}
            aria-label="Refresh auctions"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", feed.loading && "animate-spin")} />
          </Button>
          {onDismiss ? (
            <button
              type="button"
              onClick={onDismiss}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-white/5"
              aria-label="Close eBay auctions"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="border-b border-rose-500/15 bg-black/20 px-2 py-1.5">
        <div className="flex gap-1 overflow-x-auto scanner-chat-scrollbar pb-0.5">
          {feed.feeds.map((row) => (
            <FeedToggle
              key={row.id}
              active={feed.activeFeedId === row.id}
              label={row.shortLabel}
              onClick={() => feed.setActiveFeedId(row.id as EbayEndingSoonFeedId)}
            />
          ))}
        </div>
      </div>

      <div className="sc-ebay-ending-panel__scroll min-h-0 flex-1 overflow-y-auto p-2.5 scanner-chat-scrollbar sm:p-3">
        {feed.loading && listings.length === 0 ? (
          <div className="flex min-h-[12rem] items-center justify-center gap-2 text-sm text-muted">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            Loading {feed.activeFeed.shortLabel} auctions…
          </div>
        ) : feed.error && listings.length === 0 ? (
          <div className="flex min-h-[10rem] flex-col items-center justify-center gap-2 px-2 text-center">
            <p className="text-xs text-danger">{feed.error}</p>
            {feed.configHint ? (
              <p className="max-w-md text-[10px] leading-snug text-muted">{feed.configHint}</p>
            ) : null}
            <Button type="button" size="sm" variant="secondary" onClick={() => void feed.reload()}>
              Retry
            </Button>
          </div>
        ) : (
          <div className="grid gap-2">
            {listings.map((listing) => (
              <AuctionCard key={listing.id} listing={listing} nowMs={nowMs} />
            ))}
          </div>
        )}
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-white/6 px-3 py-2">
        <p className="text-[10px] text-muted">
          <span className="font-mono text-slate-400">{listings.length}</span> live ·{" "}
          {feed.activeFeed.shortLabel}
        </p>
        <a
          href={hubUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-200/90 hover:text-rose-100"
        >
          Open full search
          <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
      </footer>
    </div>
  );
}
