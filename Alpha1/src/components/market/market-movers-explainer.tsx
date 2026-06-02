"use client";

import {
  CATALOG_MOMENTUM_EXPLAINER,
  CATALOG_MOMENTUM_SUBTITLE,
} from "@/lib/market/catalog-momentum";
import { cn } from "@/lib/cn";

export function MarketMoversSectionHeader({
  title = "7-day market movers",
  subtitle,
  className,
}: {
  title?: string;
  /** Overrides default subtitle when set (e.g. weak-signal movers). */
  subtitle?: string | null;
  className?: string;
}) {
  const detail = subtitle?.trim() || CATALOG_MOMENTUM_SUBTITLE;
  return (
    <div className={cn(className)}>
      <p className="text-[9px] font-semibold uppercase tracking-wide text-sky-200/90">{title}</p>
      <p className="text-[8px] leading-snug text-muted">{detail}</p>
    </div>
  );
}

export function MarketMoversFootnote({
  usCount,
  euCount,
  className,
}: {
  usCount?: number;
  euCount?: number;
  className?: string;
}) {
  const parts: string[] = [];
  if (usCount != null && usCount > 0) parts.push(`${usCount} US (TCGPlayer/eBay)`);
  if (euCount != null && euCount > 0) parts.push(`${euCount} EU (Cardmarket)`);

  return (
    <p className={cn("text-[8px] leading-relaxed text-muted/90", className)}>
      {CATALOG_MOMENTUM_EXPLAINER}
      {parts.length > 0 ? ` This view: ${parts.join(" · ")}.` : null}
    </p>
  );
}
