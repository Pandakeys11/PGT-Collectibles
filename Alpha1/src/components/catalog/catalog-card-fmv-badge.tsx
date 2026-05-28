"use client";

import {
  catalogPriceSnapshotFromCardInput,
  formatCatalogFmvUsd,
  resolveCatalogRawFmvForCard,
  type CatalogCardPriceInput,
  type CatalogRawFmv,
} from "@/lib/market/catalog-raw-fmv";
import { cn } from "@/lib/cn";

export type CatalogCardFmvProps = CatalogCardPriceInput & {
  catalogFinish?: "reverse_holo";
  rarity?: string | null;
  name?: string | null;
  number?: string | null;
  setName?: string | null;
  /** Pre-resolved on server for master catalog grids (matches detail intel). */
  rawFmvUsd?: number | null;
  rawFmvSourceLabel?: string | null;
};

export function useCatalogCardRawFmv(args: CatalogCardFmvProps): CatalogRawFmv {
  const prices = catalogPriceSnapshotFromCardInput(args);
  const computed = resolveCatalogRawFmvForCard({
    catalogPrices: prices,
    catalogFinish: args.catalogFinish,
    rarity: args.rarity,
    identity: args.name ? { name: args.name, number: args.number, set: args.setName } : null,
  });
  if (args.rawFmvUsd != null) {
    return {
      ...computed,
      usd: args.rawFmvUsd,
      sourceLabel: args.rawFmvSourceLabel ?? computed.sourceLabel,
    };
  }
  return computed;
}

/** Bottom ribbon on card art — always visible in master catalog grids. */
export function CatalogCardFmvRibbon({
  className,
  compact = true,
  ...args
}: CatalogCardFmvProps & { className?: string; compact?: boolean }) {
  const fmv = useCatalogCardRawFmv(args);
  const hasPrice = fmv.usd != null;

  return (
    <div
      className={cn(
        "sc-catalog-fmv-ribbon pointer-events-none absolute inset-x-0 bottom-0 z-[3] flex items-center justify-between gap-1 border-t border-amber-400/40 bg-gradient-to-t from-black/95 via-black/88 to-black/70 px-1 py-0.5 shadow-[0_-2px_8px_rgba(0,0,0,0.45)] backdrop-blur-[3px] sm:px-1.5 sm:py-1",
        compact ? "min-h-[1.05rem] sm:min-h-[1.15rem]" : "min-h-[1.25rem]",
        className,
      )}
      title={hasPrice ? `Raw FMV · ${fmv.sourceLabel}` : "Raw FMV · price pending"}
    >
      <span
        className={cn(
          "font-bold uppercase leading-none text-amber-200/90",
          compact
            ? "text-[6px] tracking-[0.1em] sm:text-[7px]"
            : "text-[7px] tracking-[0.12em] sm:text-[8px]",
        )}
      >
        Raw FMV
      </span>
      <span
        className={cn(
          "font-mono font-bold tabular-nums leading-none",
          compact ? "text-[9px] sm:text-[10px]" : "text-[10px] sm:text-xs",
          hasPrice ? "text-amber-50 drop-shadow-[0_0_6px_rgba(251,191,36,0.35)]" : "text-white/40",
        )}
      >
        {hasPrice ? formatCatalogFmvUsd(fmv.usd) : "Pending"}
      </span>
    </div>
  );
}

/** Strip between card art and title (standalone pages). */
export function CatalogCardFmvBar({
  className,
  ...args
}: CatalogCardFmvProps & { className?: string }) {
  const fmv = useCatalogCardRawFmv(args);
  const hasPrice = fmv.usd != null;

  return (
    <div
      className={cn(
        "sc-catalog-fmv-bar flex shrink-0 items-center justify-between gap-1 border-y border-amber-400/25 bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-transparent px-1.5 py-0.5",
        className,
      )}
      title={hasPrice ? `Raw FMV · ${fmv.sourceLabel}` : "Raw FMV · price pending"}
    >
      <span className="text-[7px] font-bold uppercase tracking-[0.14em] text-amber-200/75">Raw FMV</span>
      <span
        className={cn(
          "font-mono text-[11px] font-bold tabular-nums leading-none sm:text-xs",
          hasPrice ? "text-amber-100" : "text-white/35",
        )}
      >
        {hasPrice ? formatCatalogFmvUsd(fmv.usd) : "Pending"}
      </span>
    </div>
  );
}

/** Overlay on card art (top-left chip). */
export function CatalogCardFmvBadge({
  className,
  size = "sm",
  ...args
}: CatalogCardFmvProps & {
  className?: string;
  size?: "xs" | "sm" | "md";
}) {
  const raw = useCatalogCardRawFmv(args);
  if (raw.usd == null) return null;

  return (
    <div
      className={cn(
        "sc-catalog-fmv-badge pointer-events-none absolute z-[2] flex max-w-[calc(100%-0.35rem)] flex-col items-start gap-px rounded border border-black/50 bg-black/80 shadow-sm backdrop-blur-[2px]",
        size === "xs" && "left-0.5 top-0.5 px-1 py-px",
        size === "sm" && "left-1 top-1 px-1.5 py-0.5",
        size === "md" && "left-1.5 top-1.5 px-2 py-1",
        className,
      )}
    >
      <span
        className={cn(
          "font-bold uppercase leading-none tracking-[0.1em] text-white/75",
          size === "xs" && "text-[6px]",
          size === "sm" && "text-[7px]",
          size === "md" && "text-[8px]",
        )}
      >
        FMV
      </span>
      <span
        className={cn(
          "font-mono font-semibold leading-none text-amber-300",
          size === "xs" && "text-[9px]",
          size === "sm" && "text-[10px]",
          size === "md" && "text-sm",
        )}
      >
        {formatCatalogFmvUsd(raw.usd)}
      </span>
    </div>
  );
}

/** Inline price next to card meta (secondary). */
export function CatalogCardFmvInline({
  className,
  ...args
}: CatalogCardFmvProps & { className?: string }) {
  const raw = useCatalogCardRawFmv(args);
  if (raw.usd == null) return null;

  return (
    <span
      className={cn(
        "shrink-0 font-mono text-[10px] font-bold tabular-nums leading-none text-amber-200",
        className,
      )}
      title={`Raw FMV · ${raw.sourceLabel}`}
    >
      {formatCatalogFmvUsd(raw.usd)}
    </span>
  );
}

export { catalogPriceSnapshotFromCardInput };
