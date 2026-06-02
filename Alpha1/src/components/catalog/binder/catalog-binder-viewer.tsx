"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";
import { CatalogBinderChrome } from "@/components/catalog/binder/catalog-binder-chrome";
import { CatalogBinderControls } from "@/components/catalog/binder/catalog-binder-controls";
import { CatalogBinderPage } from "@/components/catalog/binder/catalog-binder-page";
import { CatalogBinderSlot } from "@/components/catalog/binder/catalog-binder-slot";
import { useViewportMobile } from "@/hooks/use-viewport-mobile";
import { useBinderTheme } from "@/hooks/use-binder-theme";
import { binderThemeClass } from "@/lib/catalog/binder-theme";
import {
  binderPageCount,
  binderPageLabel,
  binderSpreadCount,
  binderSpreadLabel,
  padToBinderSpreads,
  sliceBinderPage,
  sliceBinderSpread,
} from "@/lib/catalog/binder-layout";
import { cn } from "@/lib/cn";

export function CatalogBinderViewer<T>({
  cards,
  loading,
  error,
  setName,
  getKey,
  renderSlot,
  embedded = false,
  trackerBar,
  filterChrome,
  className,
}: {
  cards: T[];
  loading?: boolean;
  error?: string | null;
  setName?: string;
  getKey: (card: T) => string;
  renderSlot: (card: T, ctx: { slotIndex: number; priority: boolean }) => ReactNode;
  embedded?: boolean;
  trackerBar?: ReactNode;
  filterChrome?: ReactNode;
  className?: string;
}) {
  const mobile = useViewportMobile();
  const { theme: binderTheme, setTheme: setBinderTheme } = useBinderTheme();
  const [spreadIndex, setSpreadIndex] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [turnDir, setTurnDir] = useState<"prev" | "next" | null>(null);
  const touchStartX = useRef<number | null>(null);
  const turnTimerRef = useRef<number | null>(null);

  useEffect(() => setMounted(true), []);

  const padded = useMemo(() => padToBinderSpreads(cards), [cards]);
  const spreadTotal = useMemo(() => binderSpreadCount(cards.length), [cards.length]);
  const pageTotal = useMemo(() => binderPageCount(padded.length), [padded.length]);

  useEffect(() => {
    setSpreadIndex(0);
    setPageIndex(0);
    setTurnDir(null);
  }, [setName]);

  useEffect(() => {
    const maxSpread = Math.max(0, spreadTotal - 1);
    if (spreadIndex > maxSpread) setSpreadIndex(maxSpread);
    const maxPage = Math.max(0, pageTotal - 1);
    if (pageIndex > maxPage) setPageIndex(maxPage);
  }, [spreadTotal, pageTotal, spreadIndex, pageIndex]);

  useEffect(() => {
    return () => {
      if (turnTimerRef.current != null) window.clearTimeout(turnTimerRef.current);
    };
  }, []);

  const pulseTurn = useCallback((dir: "prev" | "next") => {
    setTurnDir(dir);
    if (turnTimerRef.current != null) window.clearTimeout(turnTimerRef.current);
    turnTimerRef.current = window.setTimeout(() => setTurnDir(null), 520);
  }, []);

  const spread = useMemo(
    () => sliceBinderSpread(padded, spreadIndex),
    [padded, spreadIndex],
  );
  const mobilePage = useMemo(
    () => sliceBinderPage(padded, pageIndex),
    [padded, pageIndex],
  );

  const navLabel = mobile
    ? binderPageLabel(pageIndex, pageTotal)
    : binderSpreadLabel(spreadIndex, spreadTotal);

  const goPrev = useCallback(() => {
    if (mobile) {
      if (pageIndex <= 0) return;
      pulseTurn("prev");
      setPageIndex((p) => Math.max(0, p - 1));
    } else {
      if (spreadIndex <= 0) return;
      pulseTurn("prev");
      setSpreadIndex((p) => Math.max(0, p - 1));
    }
  }, [mobile, pageIndex, spreadIndex, pulseTurn]);

  const goNext = useCallback(() => {
    if (mobile) {
      if (pageIndex >= pageTotal - 1) return;
      pulseTurn("next");
      setPageIndex((p) => Math.min(pageTotal - 1, p + 1));
    } else {
      if (spreadIndex >= spreadTotal - 1) return;
      pulseTurn("next");
      setSpreadIndex((p) => Math.min(spreadTotal - 1, p + 1));
    }
  }, [mobile, pageIndex, pageTotal, spreadIndex, spreadTotal, pulseTurn]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded, goPrev, goNext]);

  useEffect(() => {
    if (!expanded) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [expanded]);

  const prevDisabled = mobile ? pageIndex <= 0 : spreadIndex <= 0;
  const nextDisabled = mobile
    ? pageIndex >= pageTotal - 1
    : spreadIndex >= spreadTotal - 1;

  const renderSlots = (slots: (T | null)[], baseIndex: number) =>
    slots.map((card, i) => {
      const slotIndex = baseIndex + i;
      const priority = slotIndex < 18;
      if (!card) {
        return <CatalogBinderSlot key={`empty-${slotIndex}`} empty />;
      }
      return (
        <CatalogBinderSlot key={getKey(card)}>
          {renderSlot(card, { slotIndex, priority })}
        </CatalogBinderSlot>
      );
    });

  const binderBody = (
    <div
      className={cn(
        "sc-binder-root sc-binder-root--embedded",
        binderThemeClass(binderTheme),
        mobile && !expanded && "sc-binder-root--mobile-page sc-binder-root--mobile-scroll",
        expanded && "sc-binder-root--expanded",
        className,
      )}
    >
      {expanded ? (
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-200/90">
              Binder view
            </p>
            {setName ? (
              <p className="truncate text-sm font-medium text-slate-100">{setName}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {trackerBar ? <div className="sc-binder-tracker-slot shrink-0">{trackerBar}</div> : null}

      <CatalogBinderChrome filterChrome={filterChrome}>
        <CatalogBinderControls
          navLabel={navLabel}
          onPrev={goPrev}
          onNext={goNext}
          prevDisabled={prevDisabled}
          nextDisabled={nextDisabled}
          expanded={expanded}
          mobilePage={mobile && !expanded}
          binderTheme={binderTheme}
          onBinderThemeChange={setBinderTheme}
          onToggleExpand={() => setExpanded((v) => !v)}
          className={expanded ? "shrink-0 px-4 pt-2" : undefined}
        />
      </CatalogBinderChrome>

      <div
        className={cn(
          "sc-binder-stage sc-binder-stage--embedded",
          mobile && !expanded && "sc-binder-stage--mobile-page sc-binder-stage--mobile-scroll",
          expanded && "min-h-0 flex-1 px-3 pb-4 pt-1",
        )}
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const start = touchStartX.current;
          touchStartX.current = null;
          if (start == null) return;
          const end = e.changedTouches[0]?.clientX;
          if (end == null) return;
          const dx = end - start;
          if (Math.abs(dx) < 48) return;
          if (dx > 0) goPrev();
          else goNext();
        }}
      >
        {loading && cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-sm text-muted">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
            Loading binder pages…
          </div>
        ) : error ? (
          <p className="py-12 text-center text-sm text-danger">{error}</p>
        ) : cards.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted">No cards in this view.</p>
        ) : mobile ? (
          <div className="sc-binder-cover">
            <div
              className={cn(
                "sc-binder-book sc-binder-book--mobile",
                turnDir === "next" && "sc-binder-book--turn-next",
                turnDir === "prev" && "sc-binder-book--turn-prev",
              )}
              key={`mobile-page-${pageIndex}`}
            >
              <CatalogBinderPage
                side="single"
                className="sc-binder-page--single"
                compactHeader={embedded}
                label={setName ?? "Binder page"}
                rangeLabel={navLabel}
              >
                {renderSlots(mobilePage, pageIndex * 15)}
              </CatalogBinderPage>
            </div>
          </div>
        ) : (
          <div className="sc-binder-cover">
            <div
              className={cn(
                "sc-binder-book",
                turnDir === "next" && "sc-binder-book--turn-next",
                turnDir === "prev" && "sc-binder-book--turn-prev",
              )}
              key={`spread-${spreadIndex}`}
            >
              <CatalogBinderPage
                side="left"
                compactHeader={embedded}
                label="Left page"
                rangeLabel={navLabel}
              >
                {renderSlots(spread.left, spreadIndex * 30)}
              </CatalogBinderPage>
              <div className="sc-binder-spine" aria-hidden>
                <div className="sc-binder-spine__rings">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
              <CatalogBinderPage side="right" compactHeader={embedded} label="Right page">
                {renderSlots(spread.right, spreadIndex * 30 + 15)}
              </CatalogBinderPage>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (expanded && mounted) {
    return createPortal(binderBody, document.body);
  }

  return binderBody;
}
