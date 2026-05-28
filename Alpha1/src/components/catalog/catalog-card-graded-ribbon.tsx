"use client";

import { resolveCatalogGradedGuide } from "@/lib/market/catalog-graded-guide";
import {
  catalogPriceSnapshotFromCardInput,
  formatCatalogFmvUsd,
  type CatalogCardPriceInput,
} from "@/lib/market/catalog-raw-fmv";
import { cn } from "@/lib/cn";

/** Compact PSA guide chips on catalog card tiles (PSA 10 / 9 when cached). */
export function CatalogCardGradedRibbon({
  className,
  ...args
}: CatalogCardPriceInput & { className?: string }) {
  const prices = catalogPriceSnapshotFromCardInput(args);
  const guide = resolveCatalogGradedGuide(prices);
  const show = guide.tiers.filter((t) => t.label === "PSA 10" || t.label === "PSA 9").slice(0, 2);
  if (show.length === 0) return null;

  return (
    <div
      className={cn(
        "pointer-events-none absolute right-0 top-0 z-[2] flex max-w-[55%] flex-col items-end gap-px p-0.5",
        className,
      )}
    >
      {show.map((tier) => (
        <span
          key={tier.label}
          className="rounded border border-black/55 bg-black/82 px-1 py-px font-mono text-[7px] font-semibold leading-none text-violet-200 shadow-sm backdrop-blur-[2px] sm:text-[8px]"
          title={`${tier.label} guide · ${tier.source}`}
        >
          {tier.label.replace("PSA ", "")} {formatCatalogFmvUsd(tier.usd)}
        </span>
      ))}
    </div>
  );
}
