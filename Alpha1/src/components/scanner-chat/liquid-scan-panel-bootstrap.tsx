"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { LIQUID_SCAN_PATH } from "@/lib/app-routes";
import { parseScannerPrefill } from "@/lib/scan/catalog-bridge";
import type { CatalogScanPrefill } from "@/lib/scan/catalog-bridge";

export function LiquidScanPanelBootstrap({
  onOpenCatalog,
  onOpenCompanion,
  onOpenCalculator,
  onOpenLiveMarket,
  onOpenEbayEnding,
  onOpenPgtYoutube,
  onOpenPgtArcade,
  onOpenSlabzRip,
  onCatalogPrefill,
}: {
  onOpenCatalog: () => void;
  onOpenCompanion: () => void;
  onOpenCalculator: () => void;
  onOpenLiveMarket: () => void;
  onOpenEbayEnding: () => void;
  onOpenPgtYoutube: () => void;
  onOpenPgtArcade: () => void;
  onOpenSlabzRip: () => void;
  onCatalogPrefill: (prefill: CatalogScanPrefill) => void;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const consumedRef = useRef(false);

  useEffect(() => {
    if (consumedRef.current) return;

    const prefill = parseScannerPrefill(searchParams);
    if (prefill) {
      consumedRef.current = true;
      onCatalogPrefill(prefill);
      router.replace(LIQUID_SCAN_PATH, { scroll: false });
      return;
    }

    const panel = searchParams.get("panel")?.trim().toLowerCase();
    if (!panel) return;

    consumedRef.current = true;
    if (panel === "catalog") onOpenCatalog();
    else if (panel === "companion") onOpenCompanion();
    else if (panel === "calculator") onOpenCalculator();
    else if (panel === "live-market" || panel === "market") onOpenLiveMarket();
    else if (panel === "ebay-ending" || panel === "auctions") onOpenEbayEnding();
    else if (panel === "pgt-youtube" || panel === "pgt-video" || panel === "youtube") onOpenPgtYoutube();
    else if (panel === "pgt-arcade" || panel === "arcade" || panel === "emulator") onOpenPgtArcade();
    else if (panel === "slabz-rip" || panel === "slabz" || panel === "packs") onOpenSlabzRip();
    router.replace(LIQUID_SCAN_PATH, { scroll: false });
  }, [
    searchParams,
    router,
    onOpenCatalog,
    onOpenCompanion,
    onOpenCalculator,
    onOpenLiveMarket,
    onOpenEbayEnding,
    onOpenPgtYoutube,
    onOpenPgtArcade,
    onOpenSlabzRip,
    onCatalogPrefill,
  ]);

  return null;
}
