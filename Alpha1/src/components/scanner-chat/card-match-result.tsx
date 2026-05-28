"use client";

import { motion } from "framer-motion";
import {
  AlertTriangle,
  BadgeCheck,
  CircleHelp,
  DollarSign,
  ExternalLink,
  Plus,
  Tag,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import { CatalogCardThumb } from "@/components/scan-panels/catalog-card-thumb";
import type { CardMatch } from "@/lib/scanner-chat/types";
import { buildEbayHubForCard } from "@/lib/market/sources";
import { isJapanesePokemonCard } from "@/lib/scan/japanese-pokemon";
import { cn } from "@/lib/cn";

function statusMeta(status: CardMatch["status"]) {
  switch (status) {
    case "verified":
      return {
        label: "Verified",
        icon: BadgeCheck,
        className: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25",
        glow: "sc-confidence-glow-high",
      };
    case "review":
      return {
        label: "Needs Review",
        icon: AlertTriangle,
        className: "text-amber-400 bg-amber-500/10 border-amber-500/25",
        glow: "sc-confidence-glow-mid",
      };
    default:
      return {
        label: "Multiple Matches",
        icon: CircleHelp,
        className: "text-rose-400 bg-rose-500/10 border-rose-500/25",
        glow: "sc-confidence-glow-low",
      };
  }
}

function confidenceTone(c: number) {
  if (c >= 85) return "text-emerald-300";
  if (c >= 65) return "text-amber-300";
  return "text-rose-300";
}

export function CardMatchResult({
  card,
  index,
  selected,
  onSelect,
  onCorrectMatch,
  onWrongMatch,
  onViewComps,
  onAddToCollection,
  onExclude,
  stackPricing,
}: {
  card: CardMatch;
  index: number;
  /** Stack FMV / sticker vertically (mobile drawer & narrow widths). */
  stackPricing?: boolean;
  selected?: boolean;
  onSelect?: (specimenId: string) => void;
  onCorrectMatch?: (specimenId: string) => void;
  onWrongMatch?: (specimenId: string) => void;
  onViewComps?: (specimenId: string) => void;
  onAddToCollection?: (specimenId: string) => void;
  onExclude?: (specimenId: string) => void;
}) {
  const status = statusMeta(card.status);
  const StatusIcon = status.icon;
  const ebaySoldHub = card.extractedCard
    ? buildEbayHubForCard(card.extractedCard).sold
    : null;
  const japaneseCard = card.extractedCard ? isJapanesePokemonCard(card.extractedCard) : false;
  const japaneseName = card.extractedCard?.japaneseName ?? card.extractedCard?.printedName;
  const counterpartSet = card.extractedCard?.setNameEnglish;
  const marketConfidence = card.extractedCard?.pricingConfidence;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className={cn(
        "sc-glow-border overflow-hidden rounded-2xl sc-glass transition ring-2",
        selected ? "ring-emerald-400/50" : "ring-transparent",
      )}
    >
      <button
        type="button"
        onClick={() => onSelect?.(card.specimenId)}
        className="flex w-full gap-3 p-3 text-left sm:gap-4 sm:p-4"
      >
        <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br sm:h-24 sm:w-[4.5rem]">
          {card.extractedCard ? (
            <CatalogCardThumb
              specimenId={card.specimenId}
              card={card.extractedCard}
              catalogImageUrl={card.catalogImageUrl}
              className="h-full w-full"
            />
          ) : (
            <div className={cn("h-full w-full sc-holo-shimmer bg-gradient-to-br", card.thumbnailGradient)} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h4 className="text-[13px] font-semibold text-slate-100 sm:text-sm">{card.name}</h4>
              <p className="text-[11px] text-slate-500 sm:text-xs">
                {card.setName} · {card.setNumber} · {card.year}
              </p>
              {card.printVersion || card.printPromo ? (
                <p className="mt-1 text-[11px] font-medium leading-snug text-violet-200/95 sm:text-xs">
                  {card.printVersion}
                  {card.printPromo && card.printPromo !== card.printVersion
                    ? ` · ${card.printPromo}`
                    : ""}
                </p>
              ) : null}
              {japaneseCard ? (
                <p className="mt-1 text-[11px] leading-snug text-slate-400 sm:text-xs">
                  {japaneseName ? `Japanese: ${japaneseName}` : "Japanese-language card"}
                  {counterpartSet ? ` · English counterpart: ${counterpartSet}` : ""}
                </p>
              ) : null}
            </div>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                status.className,
                status.glow,
              )}
            >
              <StatusIcon className="h-3 w-3" />
              {status.label}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
            {japaneseCard ? (
              <span className="rounded-md border border-red-400/25 bg-red-500/10 px-1.5 py-0.5 text-red-100">
                Japanese
              </span>
            ) : null}
            {japaneseCard && counterpartSet ? (
              <span className="rounded-md border border-sky-400/25 bg-sky-500/10 px-1.5 py-0.5 text-sky-100">
                Matched Counterpart
              </span>
            ) : null}
            {japaneseCard && card.sources.some((source) => /ebay|pricecharting|cardmarket/i.test(source)) ? (
              <span className="rounded-md border border-emerald-400/25 bg-emerald-500/10 px-1.5 py-0.5 text-emerald-100">
                Japanese Market Data
              </span>
            ) : null}
            {card.extractedCard?.fallbackUsed ? (
              <span className="rounded-md border border-amber-400/25 bg-amber-500/10 px-1.5 py-0.5 text-amber-100">
                Fallback Estimate
              </span>
            ) : null}
            {japaneseCard && card.catalogImageSourceLabel ? (
              <span
                className={cn(
                  "rounded-md border px-1.5 py-0.5",
                  card.catalogImageSource === "english_fallback"
                    ? "border-amber-400/25 bg-amber-500/10 text-amber-100"
                    : card.catalogImageNeedsReview
                      ? "border-rose-400/25 bg-rose-500/10 text-rose-100"
                      : "border-emerald-400/25 bg-emerald-500/10 text-emerald-100",
                )}
              >
                {card.catalogImageSourceLabel}
              </span>
            ) : null}
            <span className="rounded-md bg-white/5 px-1.5 py-0.5">{card.rarity}</span>
            {card.printVersion ? (
              <span className="rounded-md border border-violet-500/25 bg-violet-500/12 px-1.5 py-0.5 text-violet-200/95">
                {card.printVersion}
              </span>
            ) : null}
            {card.printPromo && card.printPromo !== card.printVersion ? (
              <span className="rounded-md border border-fuchsia-500/20 bg-fuchsia-500/10 px-1.5 py-0.5 text-fuchsia-200/90">
                {card.printPromo}
              </span>
            ) : null}
            {card.condition ? (
              <span className="rounded-md bg-white/5 px-1.5 py-0.5">{card.condition}</span>
            ) : null}
            {card.graded ? (
              <span className="rounded-md bg-sky-500/15 px-1.5 py-0.5 text-sky-300">
                {card.graded.company} {card.graded.grade}
                {card.graded.cert ? ` · #${card.graded.cert}` : ""}
              </span>
            ) : null}
            <span className={cn("font-medium", confidenceTone(card.confidence))}>
              {card.confidence}% confidence
            </span>
            {marketConfidence != null ? (
              <span className={cn("font-medium", confidenceTone(Math.round(marketConfidence * 100)))}>
                Market {Math.round(marketConfidence * 100)}%
              </span>
            ) : null}
          </div>
          {card.hasSticker || (card.fmvUsd != null && card.fmvUsd > 0) || card.soldCompCount > 0 ? (
            <div className="mt-2 space-y-2">
              <div
                className={cn(
                  "grid gap-2",
                  stackPricing
                    ? "grid-cols-1"
                    : card.hasSticker && (card.fmvUsd != null || card.latestSoldUsd != null)
                      ? "grid-cols-1 min-[400px]:grid-cols-2"
                      : "grid-cols-1",
                )}
              >
                <div
                  className={cn(
                    "rounded-lg border px-2.5 py-2",
                    card.fmvUsd != null && card.fmvUsd > 0
                      ? "border-emerald-500/25 bg-emerald-500/8"
                      : "border-white/10 bg-white/[0.03]",
                  )}
                >
                  <p className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-emerald-400/90">
                    <DollarSign className="h-3 w-3 shrink-0" aria-hidden />
                    Fair market value
                  </p>
                  <p
                    className={cn(
                      "font-mono text-base font-semibold tabular-nums sm:text-lg",
                      card.fmvUsd != null && card.fmvUsd > 0
                        ? "text-emerald-300"
                        : "text-slate-500",
                    )}
                  >
                    {card.fmvUsd != null && card.fmvUsd > 0 ? card.fmvDisplay : "—"}
                  </p>
                  <p className="mt-0.5 text-[9px] leading-snug text-slate-500">
                    From sold comps &amp; market data
                  </p>
                </div>

                {card.hasSticker ? (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2">
                    <p className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-amber-300/95">
                      <Tag className="h-3 w-3 shrink-0" aria-hidden />
                      Sticker price
                    </p>
                    <p className="font-mono text-base font-semibold tabular-nums text-amber-200 sm:text-lg">
                      {card.stickerDisplay}
                    </p>
                    <p className="mt-0.5 text-[9px] leading-snug text-amber-200/70">
                      On slab or photo — not FMV
                    </p>
                  </div>
                ) : null}
              </div>

              {card.latestSoldUsd != null ? (
                <div className="flex items-center justify-between gap-2 rounded-md border border-white/8 bg-white/[0.02] px-2 py-1.5">
                  <p className="text-[9px] font-medium uppercase tracking-wide text-slate-500">
                    Latest sold comp
                  </p>
                  <p className="font-mono text-xs font-medium tabular-nums text-slate-200">
                    ${Math.round(card.latestSoldUsd).toLocaleString()}
                  </p>
                </div>
              ) : null}

              {card.fmvSubline ? (
                <p className="text-[10px] leading-snug text-slate-500">{card.fmvSubline}</p>
              ) : null}
              {card.sources.length > 0 ? (
                <p className="truncate text-[9px] text-slate-600" title={card.sources.join(", ")}>
                  {card.sources.slice(0, 5).join(" · ")}
                  {card.sources.length > 5 ? ` +${card.sources.length - 5}` : ""}
                </p>
              ) : null}
              {ebaySoldHub ? (
                <a
                  href={ebaySoldHub}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400/90 hover:text-emerald-300 hover:underline"
                >
                  Verify on eBay sold
                  <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              ) : null}
            </div>
          ) : card.soldCompCount > 0 || card.sources.length > 0 ? (
            <p className="mt-2 text-xs text-slate-500">
              Comps loading — FMV needs more sold evidence for this grade.
            </p>
          ) : (
            <p className="mt-2 text-xs text-slate-600">Market estimate loading…</p>
          )}
        </div>
      </button>
      <div className="flex flex-wrap gap-1 border-t border-white/6 px-3 py-2 sm:px-4">
        <button
          type="button"
          onClick={() => onCorrectMatch?.(card.specimenId)}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] text-emerald-400/90 transition hover:bg-emerald-500/10"
        >
          <ThumbsUp className="h-3 w-3" />
          Correct match
        </button>
        <button
          type="button"
          onClick={() => onWrongMatch?.(card.specimenId)}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] text-amber-400/90 transition hover:bg-amber-500/10"
        >
          <ThumbsDown className="h-3 w-3" />
          Wrong match
        </button>
        <button
          type="button"
          onClick={() => onViewComps?.(card.specimenId)}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] text-slate-500 transition hover:bg-white/5 hover:text-slate-300"
        >
          <ExternalLink className="h-3 w-3" />
          View comps
        </button>
        <button
          type="button"
          onClick={() => onAddToCollection?.(card.specimenId)}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] text-slate-500 transition hover:bg-white/5 hover:text-slate-300"
        >
          <Plus className="h-3 w-3" />
          Add to collection
        </button>
        <button
          type="button"
          onClick={() => onExclude?.(card.specimenId)}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] text-rose-400/80 transition hover:bg-rose-500/10"
        >
          <Trash2 className="h-3 w-3" />
          Exclude
        </button>
      </div>
    </motion.div>
  );
}
