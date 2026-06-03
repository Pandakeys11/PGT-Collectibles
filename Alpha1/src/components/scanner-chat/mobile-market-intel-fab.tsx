"use client";

import { TrendingUp } from "lucide-react";

/** Floating entry to daily market desk when no scan session is active. */
export function MobileMarketIntelFab({
  visible,
  onOpen,
}: {
  visible: boolean;
  onOpen: () => void;
}) {
  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="sc-mobile-intel-fab fixed left-1/2 z-[45] flex -translate-x-1/2 items-center gap-2 rounded-full border border-violet-500/35 bg-[rgb(8,12,16)]/95 px-4 py-2.5 text-[11px] font-medium text-violet-100 shadow-lg shadow-black/40 backdrop-blur-xl touch-manipulation active:scale-[0.98] lg:hidden"
    >
      <TrendingUp className="h-4 w-4 shrink-0 text-violet-300" aria-hidden />
      <span>Market desk</span>
    </button>
  );
}
