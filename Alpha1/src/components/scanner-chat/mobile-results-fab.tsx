"use client";

import { ChevronRight } from "lucide-react";

/** Floating entry when results exist but the sheet is closed. */
export function MobileResultsFab({
  visible,
  cardCount,
  scanning,
  onOpen,
}: {
  visible: boolean;
  cardCount: number;
  scanning?: boolean;
  onOpen: () => void;
}) {
  if (!visible || cardCount === 0) return null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="sc-mobile-results-fab fixed left-1/2 z-[45] flex -translate-x-1/2 items-center gap-2 rounded-full border border-emerald-500/30 bg-[rgb(8,12,16)]/95 px-4 py-2.5 text-[11px] font-medium text-emerald-100 shadow-lg shadow-black/40 backdrop-blur-xl touch-manipulation active:scale-[0.98] lg:hidden"
    >
      <span>
        {scanning ? "Scanning…" : `View ${cardCount} card${cardCount === 1 ? "" : "s"}`}
      </span>
      <ChevronRight className="h-4 w-4 opacity-80" />
    </button>
  );
}
