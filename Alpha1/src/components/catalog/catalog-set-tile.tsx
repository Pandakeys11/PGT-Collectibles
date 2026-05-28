"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

export type CatalogSetTileModel = {
  id: string;
  name: string;
  series?: string | null;
  releaseDate?: string | null;
  year?: string | null;
  total?: number | null;
  printedTotal?: number | null;
  images?: { logo?: string | null; symbol?: string | null } | null;
  badge?: string | null;
  /** Optional set-level movement (from insight / movers). */
  changePct?: number | null;
  eraLabel?: string | null;
};

function setInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return name.trim().slice(0, 2).toUpperCase() || "?";
}

function formatShortDate(value?: string | null): string | null {
  if (!value?.trim()) return null;
  const time = new Date(value.replace(/\//g, "-")).getTime();
  if (!Number.isFinite(time)) return value.slice(0, 10);
  return new Date(time).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function SetLogoHero({
  name,
  logoUrl,
  compact,
  vault,
}: {
  name: string;
  logoUrl?: string | null;
  compact?: boolean;
  vault?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (vault) {
    return (
      <div
        className={cn(
          "sc-catalog-set-tile-hero relative flex items-center justify-center overflow-hidden",
          compact ? "h-[4.5rem]" : "h-[5.25rem] sm:h-[5.75rem]",
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.08),transparent_58%)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#070b10] to-transparent" />
        {!logoUrl || failed ? (
          <span
            className="relative z-10 text-sm font-black uppercase tracking-widest text-white/35"
            aria-hidden
          >
            {setInitials(name)}
          </span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt=""
            className="relative z-10 max-h-[72%] max-w-[82%] object-contain object-center drop-shadow-[0_8px_20px_rgba(0,0,0,0.5)] transition duration-500 group-hover:scale-105"
            loading="lazy"
            onError={() => setFailed(true)}
          />
        )}
      </div>
    );
  }

  const frame = cn(
    "flex w-full items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-[#05080c]/90",
    compact ? "aspect-[5/3] p-2" : "aspect-[4/3] p-2.5 sm:p-3",
  );

  if (!logoUrl || failed) {
    return (
      <div className={cn(frame, "text-lg font-bold tracking-tight text-amber-200/40 sm:text-xl")} aria-hidden>
        {setInitials(name)}
      </div>
    );
  }

  return (
    <div className={frame}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logoUrl}
        alt=""
        className="max-h-full max-w-[88%] object-contain object-center drop-shadow-[0_4px_12px_rgba(0,0,0,0.45)]"
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

export function CatalogSetTile({
  set,
  selected,
  onSelect,
  compact = false,
  vault = true,
}: {
  set: CatalogSetTileModel;
  selected?: boolean;
  onSelect: () => void;
  compact?: boolean;
  /** Legacy vault presentation (logo hero, foil accents). */
  vault?: boolean;
}) {
  const logo = set.images?.logo || set.images?.symbol;
  const cardCount = set.printedTotal ?? set.total;
  const release = formatShortDate(set.releaseDate) ?? set.year;
  const change = set.changePct;
  const hasChange = change != null && Number.isFinite(change);
  const isUp = hasChange && change >= 0;

  if (!vault) {
    const metaLine = [set.series, set.releaseDate ?? set.year, cardCount != null ? `${cardCount} cards` : null]
      .filter(Boolean)
      .join(" · ");

    return (
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "group flex h-full w-full flex-col rounded-xl border text-left transition touch-manipulation",
          compact ? "p-2" : "p-2.5 sm:p-3",
          selected
            ? "border-amber-400/50 bg-amber-400/[0.08] shadow-[0_0_0_1px_rgba(251,191,36,0.35)]"
            : "border-white/10 bg-gradient-to-b from-white/[0.06] to-[#070b10]/95 hover:border-amber-300/30",
        )}
      >
        <SetLogoHero name={set.name} logoUrl={logo} compact={compact} vault={false} />
        <div className="mt-2 min-w-0 flex-1">
          <p className={cn("line-clamp-2 font-semibold leading-snug text-slate-100", compact ? "text-[11px]" : "text-xs sm:text-[13px]")}>
            {set.name}
          </p>
          {metaLine ? (
            <p className={cn("mt-1 line-clamp-2 text-slate-500", compact ? "text-[9px]" : "text-[10px]")}>{metaLine}</p>
          ) : null}
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "sc-catalog-set-tile group relative flex h-full w-full flex-col overflow-hidden rounded-xl border text-left transition touch-manipulation",
        compact ? "min-h-[8.5rem]" : "min-h-[9.5rem] sm:min-h-[10rem]",
        selected
          ? "border-amber-400/45 bg-[linear-gradient(180deg,rgba(251,191,36,0.12),rgba(7,11,16,0.98))] shadow-[0_0_0_1px_rgba(251,191,36,0.32),0_14px_32px_-18px_rgba(251,191,36,0.28)]"
          : "border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(7,11,16,0.98))] hover:-translate-y-0.5 hover:border-amber-300/28 hover:shadow-[0_12px_28px_-14px_rgba(0,0,0,0.65)]",
      )}
    >
      {hasChange ? (
        <div className="absolute left-2 top-2 z-20">
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-wider",
              isUp
                ? "border-emerald-500/25 bg-emerald-500/12 text-emerald-300"
                : "border-rose-500/25 bg-rose-500/12 text-rose-300",
            )}
          >
            {isUp ? "Up" : "Down"} {Math.abs(change).toFixed(1)}%
          </span>
        </div>
      ) : null}

      {set.badge ? (
        <div className="absolute right-2 top-2 z-20">
          <span className="rounded-md border border-white/10 bg-black/50 px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wide text-amber-200/85">
            {set.badge}
          </span>
        </div>
      ) : null}

      <SetLogoHero name={set.name} logoUrl={logo} compact={compact} vault />

      <div className={cn("flex min-w-0 flex-1 flex-col", compact ? "px-2 pb-2 pt-1" : "px-2.5 pb-2.5 pt-1.5 sm:px-3 sm:pb-3")}>
        {set.series ? (
          <span className="truncate text-[8px] font-semibold uppercase tracking-[0.14em] text-amber-200/55 sm:text-[9px]">
            {set.series}
          </span>
        ) : null}
        <p
          className={cn(
            "mt-0.5 line-clamp-2 font-bold italic leading-tight tracking-tight text-slate-100 group-hover:text-amber-100",
            compact ? "text-[11px]" : "text-xs sm:text-[13px]",
          )}
        >
          {set.name}
        </p>
        <div className="mt-auto flex items-end justify-between gap-1 border-t border-white/[0.06] pt-1.5">
          <div className="min-w-0">
            {cardCount != null ? (
              <p className="truncate text-[8px] font-semibold tabular-nums text-slate-500 sm:text-[9px]">
                {cardCount.toLocaleString()} cards
              </p>
            ) : null}
            {release ? (
              <p className="truncate text-[8px] text-slate-600 sm:text-[9px]">{release}</p>
            ) : null}
          </div>
          {set.eraLabel ? (
            <span className="shrink-0 rounded-md border border-white/8 bg-white/[0.04] px-1.5 py-0.5 text-[7px] font-bold uppercase text-slate-500">
              {set.eraLabel}
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-[8px] font-black uppercase tracking-[0.18em] text-amber-400/0 transition group-hover:text-amber-400/90 sm:text-[9px]">
          Open set →
        </p>
      </div>
    </button>
  );
}

export function tcgSetToTileModel(s: {
  id: string;
  name: string;
  series?: string;
  releaseDate?: string;
  printedTotal?: number;
  total?: number;
  images?: { logo?: string; symbol?: string };
}): CatalogSetTileModel {
  return {
    id: s.id,
    name: s.name,
    series: s.series,
    releaseDate: s.releaseDate,
    total: s.total,
    printedTotal: s.printedTotal,
    images: s.images,
  };
}
