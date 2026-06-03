"use client";

import { useMemo } from "react";
import { MarketSourceAds } from "@/components/scanner-chat/market-source-ads";
import { buildIdleMarketSourceBrands } from "@/lib/market/idle-market-source-brands";
import { cn } from "@/lib/cn";

export function MarketIdleSourceHub({
  hotSetName,
  className,
}: {
  hotSetName?: string | null;
  className?: string;
}) {
  const sources = useMemo(
    () => buildIdleMarketSourceBrands(hotSetName),
    [hotSetName],
  );

  return (
    <MarketSourceAds sources={sources} variant="idle" className={cn(className)} />
  );
}
