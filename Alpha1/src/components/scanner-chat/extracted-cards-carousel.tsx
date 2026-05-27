"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
  type PanInfo,
} from "framer-motion";
import {
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Cpu,
  ExternalLink,
  Plus,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import { CatalogCardThumb } from "@/components/scan-panels/catalog-card-thumb";
import {
  GradedSlabBadge,
  GradedSlabBadgeFromCard,
} from "@/components/ui/graded-slab-badge";
import { resolveGraderBadgeFromCardMatch } from "@/lib/scan/grader-badge-styles";
import type { ScanSpecimen } from "@/hooks/use-scan-session";
import type { CatalogCandidate } from "@/lib/scan/schemas";
import type { CardMatch } from "@/lib/scanner-chat/types";
import { CatalogMatchQuickPick } from "./catalog-match-quick-pick";
import { cn } from "@/lib/cn";

const SWIPE_THRESHOLD = 56;
const STACK_DEPTH = 4;

function formatScanDate(ts?: number): string {
  const d = ts != null ? new Date(ts) : new Date();
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function sessionCountLabel(cards: CardMatch[]): string {
  const graded = cards.filter((c) => c.graded?.grade && c.graded.grade !== "—").length;
  if (cards.length === 0) return "0 cards";
  if (graded === cards.length) {
    return `${cards.length} card${cards.length === 1 ? "" : "s"} graded`;
  }
  if (graded > 0) {
    return `${cards.length} cards · ${graded} graded`;
  }
  return `${cards.length} card${cards.length === 1 ? "" : "s"} extracted`;
}

function CarouselCardArt({ card }: { card: CardMatch }) {
  const [url, setUrl] = useState<string | null>(
    card.catalogImageUrl?.trim() || card.previewUrl?.trim() || null,
  );

  useEffect(() => {
    const direct = card.catalogImageUrl?.trim() || card.previewUrl?.trim() || null;
    setUrl(direct);
  }, [card.catalogImageUrl, card.previewUrl, card.specimenId]);

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={card.name}
        className="h-full w-full object-contain p-1.5"
        draggable={false}
      />
    );
  }

  if (card.extractedCard) {
    return (
      <div className="flex h-full w-full items-center justify-center p-2">
        <CatalogCardThumb
          specimenId={card.specimenId}
          card={card.extractedCard}
          catalogImageUrl={card.catalogImageUrl}
          className="!h-[92%] !w-auto !max-w-full rounded-lg border-0 bg-transparent"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center bg-gradient-to-br sc-holo-shimmer",
        card.thumbnailGradient,
      )}
    >
      <span className="text-[10px] font-medium text-white/40">Loading art…</span>
    </div>
  );
}

function CardStackCard({
  card,
  offset,
  isActive,
}: {
  card: CardMatch;
  offset: number;
  isActive: boolean;
}) {
  const abs = Math.abs(offset);
  if (abs >= STACK_DEPTH) return null;

  const x = offset * 32;
  const scale = isActive ? 1 : 1 - abs * 0.055;
  const rotateY = offset * -7;
  const zIndex = 30 - abs;
  const opacity = isActive ? 1 : Math.max(0.38, 1 - abs * 0.2);

  return (
    <motion.div
      className="absolute top-0 aspect-[2.5/3.5] w-[min(72vw,15.5rem)] max-w-[248px]"
      style={{
        zIndex,
        left: "50%",
        marginLeft: "calc(min(72vw, 15.5rem) / -2)",
        maxWidth: 248,
        transformPerspective: 1200,
      }}
      initial={false}
      animate={{
        x,
        scale,
        rotateY,
        opacity,
        filter: isActive ? "brightness(1)" : `brightness(${1 - abs * 0.08})`,
      }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
    >
      <div
        className={cn(
          "relative h-full w-full overflow-hidden rounded-2xl bg-canvas shadow-[0_24px_64px_-28px_rgba(0,0,0,0.85)] ring-1",
          isActive ? "ring-white/12" : "ring-white/6",
        )}
      >
        <CarouselCardArt card={card} />
        {card.graded?.grade && card.graded.grade !== "—" ? (
          <div className="pointer-events-none absolute left-2 top-2 z-10">
            <GradedSlabBadge
              grader={card.graded.company}
              grade={card.graded.grade}
              labelTitle={card.extractedCard?.labelTitle}
              variant="compact"
            />
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}

function ExtractedCardInfoPanel({
  card,
  onViewComps,
}: {
  card: CardMatch;
  onViewComps?: (specimenId: string) => void;
}) {
  const cert =
    card.graded?.cert && card.graded.cert !== "NA"
      ? card.graded.cert
      : card.setNumber && card.setNumber !== "—"
        ? `#${card.setNumber}`
        : null;
  const slabStyle = resolveGraderBadgeFromCardMatch(card);
  const fmvGem =
    card.fmvUsd != null && card.fmvUsd > 0 ? card.fmvDisplay.replace(/^\$/, "") : null;

  return (
    <div
      className={cn(
        "sc-extracted-card-panel overflow-hidden rounded-[1.35rem] border bg-panel-raised/95 shadow-panel",
        slabStyle.tier === "raw" ? "border-white/10" : slabStyle.ringClass,
      )}
    >
      <div className="grid grid-cols-[minmax(5.5rem,6.25rem)_1fr]">
        <div className="border-r border-white/8 bg-black/20">
          <GradedSlabBadgeFromCard card={card} variant="gem" fmvFallback={fmvGem} />
        </div>
        <div className="flex min-w-0 flex-col justify-between px-4 py-3.5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <GradedSlabBadgeFromCard card={card} variant="chip" />
              {slabStyle.tier === "premium" ? (
                <span className="rounded-full border border-amber-300/30 bg-amber-400/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-200">
                  Premium
                </span>
              ) : null}
            </div>
            <h3 className="mt-1.5 truncate font-display text-lg font-semibold leading-snug text-white sm:text-xl">
              {card.name}
            </h3>
            <p className="mt-1 truncate text-sm text-slate-400">{card.setName}</p>
            {card.printVersion ? (
              <p className="mt-0.5 truncate text-[11px] font-medium text-violet-300/90">
                {card.printVersion}
              </p>
            ) : null}
            <div className="mt-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p
                className={cn(
                  "font-mono text-lg font-semibold tabular-nums",
                  card.fmvUsd != null && card.fmvUsd > 0 ? "text-emerald-300" : "text-slate-500",
                )}
              >
                {card.fmvUsd != null && card.fmvUsd > 0 ? card.fmvDisplay : "FMV pending"}
              </p>
              {card.latestSoldUsd != null ? (
                <p className="text-[11px] text-slate-500">
                  Last sold{" "}
                  <span className="font-mono tabular-nums text-slate-300">
                    ${Math.round(card.latestSoldUsd).toLocaleString()}
                  </span>
                </p>
              ) : null}
            </div>
            {card.fmvSubline ? (
              <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-slate-500">
                {card.fmvSubline}
              </p>
            ) : null}
            {card.soldCompCount > 0 ? (
              <p className="mt-0.5 text-[10px] text-slate-600">
                {card.soldCompCount} sold comp{card.soldCompCount === 1 ? "" : "s"}
                {card.sources.length > 0 ? ` · ${card.sources.slice(0, 2).join(", ")}` : ""}
              </p>
            ) : null}
          </div>
          <div className="mt-3 flex items-end justify-between gap-2">
            {cert ? (
              <p className="truncate font-mono text-[11px] tracking-wide text-slate-500">{cert}</p>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={() => onViewComps?.(card.specimenId)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-400 transition hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-200 touch-manipulation"
              aria-label="View market comps"
            >
              <Cpu className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ExtractedCardsCarousel({
  cards,
  specimens = [],
  scannedAt,
  selectedSpecimenId,
  onSelectSpecimen,
  onCorrectMatch,
  onWrongMatch,
  onViewComps,
  onAddToCollection,
  onExclude,
  onConfirmCatalogCandidate,
  onRejectCatalogCandidate,
  onRefreshCatalogCandidates,
  onOpenMasterCatalog,
  catalogRefreshingId,
  catalogBusy,
  className,
}: {
  cards: CardMatch[];
  specimens?: ScanSpecimen[];
  scannedAt?: number;
  selectedSpecimenId?: string | null;
  onSelectSpecimen?: (specimenId: string) => void;
  onCorrectMatch?: (specimenId: string) => void;
  onWrongMatch?: (specimenId: string) => void;
  onViewComps?: (specimenId: string) => void;
  onAddToCollection?: (specimenId: string) => void;
  onExclude?: (specimenId: string) => void;
  onConfirmCatalogCandidate?: (specimenId: string, candidate: CatalogCandidate) => void;
  onRejectCatalogCandidate?: (specimenId: string, catalogId: string) => void;
  onRefreshCatalogCandidates?: (specimenId: string) => void;
  onOpenMasterCatalog?: () => void;
  catalogRefreshingId?: string | null;
  catalogBusy?: boolean;
  className?: string;
}) {
  const selectedIndex = useMemo(() => {
    if (!selectedSpecimenId) return 0;
    const i = cards.findIndex((c) => c.specimenId === selectedSpecimenId);
    return i >= 0 ? i : 0;
  }, [cards, selectedSpecimenId]);

  const [index, setIndex] = useState(selectedIndex);
  const dragX = useMotionValue(0);
  const dragOpacity = useTransform(dragX, [-120, 0, 120], [0.92, 1, 0.92]);

  useEffect(() => {
    setIndex(selectedIndex);
  }, [selectedIndex]);

  const active = cards[index];
  const activeSpecimen = useMemo(
    () => specimens.find((s) => s.id === active?.specimenId) ?? null,
    [specimens, active?.specimenId],
  );
  const canPrev = index > 0;
  const canNext = index < cards.length - 1;

  const goTo = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(cards.length - 1, next));
      setIndex(clamped);
      const card = cards[clamped];
      if (card) onSelectSpecimen?.(card.specimenId);
      dragX.set(0);
    },
    [cards, dragX, onSelectSpecimen],
  );

  const onDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      if (info.offset.x < -SWIPE_THRESHOLD || info.velocity.x < -400) {
        if (canNext) goTo(index + 1);
        else dragX.set(0);
        return;
      }
      if (info.offset.x > SWIPE_THRESHOLD || info.velocity.x > 400) {
        if (canPrev) goTo(index - 1);
        else dragX.set(0);
        return;
      }
      dragX.set(0);
    },
    [canNext, canPrev, dragX, goTo, index],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && canPrev) goTo(index - 1);
      if (e.key === "ArrowRight" && canNext) goTo(index + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canNext, canPrev, goTo, index]);

  const stackCards = useMemo(() => {
    const items: { card: CardMatch; offset: number }[] = [];
    const current = cards[index];
    if (!current) return items;
    items.push({ card: current, offset: 0 });
    for (let i = 1; i < STACK_DEPTH && index + i < cards.length; i++) {
      items.push({ card: cards[index + i]!, offset: i });
    }
    return items;
  }, [cards, index]);

  if (!cards.length || !active) return null;

  return (
    <div
      className={cn(
        "sc-extracted-cards-carousel mx-auto w-full max-w-lg select-none lg:max-w-none",
        "xl:grid xl:grid-cols-[minmax(280px,400px)_minmax(0,1fr)] xl:items-start xl:gap-x-8 xl:gap-y-4",
        className,
      )}
    >
      <header className="flex items-baseline justify-between gap-3 px-0.5 xl:col-span-2">
        <p className="font-display text-base font-semibold text-white sm:text-lg">
          {formatScanDate(scannedAt)}
        </p>
        <p className="text-sm text-slate-500">{sessionCountLabel(cards)}</p>
      </header>

      <div className="sc-extracted-cards-stage relative mt-5 xl:mt-2">
        {cards.length > 1 ? (
          <>
            <button
              type="button"
              disabled={!canPrev}
              onClick={() => goTo(index - 1)}
              className="absolute left-0 top-1/2 z-40 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/50 text-slate-300 backdrop-blur-md transition enabled:hover:bg-white/10 disabled:opacity-25 touch-manipulation"
              aria-label="Previous card"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              disabled={!canNext}
              onClick={() => goTo(index + 1)}
              className="absolute right-0 top-1/2 z-40 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/50 text-slate-300 backdrop-blur-md transition enabled:hover:bg-white/10 disabled:opacity-25 touch-manipulation"
              aria-label="Next card"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        ) : null}

        <div className="relative mx-auto aspect-[2.5/3.5] w-full max-w-[280px] lg:max-w-[300px] xl:max-w-[340px]">
          <div className="absolute inset-0">
            {stackCards
              .slice()
              .reverse()
              .map(({ card: c, offset }) => (
                <CardStackCard
                  key={`${c.specimenId}-${offset}`}
                  card={c}
                  offset={offset}
                  isActive={offset === 0}
                />
              ))}
          </div>

          <motion.div
            className="absolute inset-0 z-50 touch-pan-y"
            style={{ x: dragX, opacity: dragOpacity }}
            drag={cards.length > 1 ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.14}
            onDragEnd={onDragEnd}
          />
        </div>

        {cards.length > 1 ? (
          <p className="mt-3 text-center text-[10px] text-slate-600">
            Swipe or use arrows · {index + 1} / {cards.length}
          </p>
        ) : null}
      </div>

      <div className="sc-extracted-cards-meta mt-5 xl:mt-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={active.specimenId}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
          >
            <ExtractedCardInfoPanel card={active} onViewComps={onViewComps} />
          </motion.div>
        </AnimatePresence>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-1 xl:justify-start">
        {active.status === "verified" ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
            <BadgeCheck className="h-3 w-3" />
            Verified
          </span>
        ) : (
          <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-200">
            Needs review
          </span>
        )}
        <span className="text-[10px] text-slate-600">·</span>
        <span className="text-[10px] tabular-nums text-slate-500">{active.confidence}% match</span>
      </div>

        {onConfirmCatalogCandidate && onRejectCatalogCandidate ? (
          <CatalogMatchQuickPick
            className="mt-3"
            specimen={activeSpecimen}
            busy={catalogBusy}
            refreshing={catalogRefreshingId === active.specimenId}
            onConfirm={onConfirmCatalogCandidate}
            onReject={onRejectCatalogCandidate}
            onRefreshCandidates={onRefreshCatalogCandidates}
            onOpenMasterCatalog={onOpenMasterCatalog}
          />
        ) : null}

        <div className="mt-3 flex flex-wrap justify-center gap-1 border-t border-white/6 pt-3 xl:justify-start">
        <button
          type="button"
          onClick={() => onCorrectMatch?.(active.specimenId)}
          className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] text-emerald-400/90 transition hover:bg-emerald-500/10 touch-manipulation"
        >
          <ThumbsUp className="h-3.5 w-3.5" />
          Correct
        </button>
        <button
          type="button"
          onClick={() => onWrongMatch?.(active.specimenId)}
          className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] text-amber-400/90 transition hover:bg-amber-500/10 touch-manipulation"
        >
          <ThumbsDown className="h-3.5 w-3.5" />
          Wrong
        </button>
        <button
          type="button"
          onClick={() => onViewComps?.(active.specimenId)}
          className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-400 transition hover:bg-white/5 touch-manipulation"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Comps
        </button>
        <button
          type="button"
          onClick={() => onAddToCollection?.(active.specimenId)}
          className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-400 transition hover:bg-white/5 touch-manipulation"
        >
          <Plus className="h-3.5 w-3.5" />
          Save
        </button>
        <button
          type="button"
          onClick={() => onExclude?.(active.specimenId)}
          className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] text-rose-400/80 transition hover:bg-rose-500/10 touch-manipulation"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Exclude
        </button>
        </div>
      </div>
    </div>
  );
}
