"use client";

import { usePathname } from "next/navigation";
import { PgtMusicBar } from "@/components/music/pgt-music-bar";
import { cn } from "@/lib/cn";
import { isFullBleedScannerPath } from "@/lib/route-paths";

/** Fixed PGT Player on standard routes; Liquid Scan uses composer strip instead. */
export function PgtMusicWidget() {
  const pathname = usePathname();
  if (isFullBleedScannerPath(pathname)) return null;

  return (
    <div
      className={cn(
        "pgt-music-widget",
        "bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px)+0.5rem)] left-3 sm:left-4 lg:bottom-6",
      )}
    >
      <PgtMusicBar />
    </div>
  );
}
