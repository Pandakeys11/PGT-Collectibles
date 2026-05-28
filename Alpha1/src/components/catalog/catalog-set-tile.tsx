"use client";

import { useState } from "react";
import { useCatalogAmbientOptional } from "@/components/effects/catalog-ambient-provider";
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
};

/** sidebar = narrow column beside cards; browse = 4×4 master catalog; full = wide standalone page */
export type CatalogSetTileDensity = "sidebar" | "browse" | "full";

function setInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return name.trim().slice(0, 2).toUpperCase() || "?";
}

function SetLogoMark({
  name,
  logoUrl,
  density,
}: {
  name: string;
  logoUrl?: string | null;
  density: CatalogSetTileDensity;
}) {
  const [failed, setFailed] = useState(false);
  const frame = cn(
    "flex w-full shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-[#05080c]/90",
    density === "sidebar" && "aspect-[2.2/1] p-1",
    density === "browse" && "aspect-[4/3] max-h-[3.25rem] p-1 sm:max-h-[3.5rem]",
    density === "full" && "aspect-[5/3] p-1.5 sm:p-2",
  );

  if (!logoUrl || failed) {
    return (
      <div
        className={cn(
          frame,
          "font-bold tracking-tight text-amber-200/40",
          density === "browse" ? "text-[10px]" : density === "sidebar" ? "text-xs" : "text-sm sm:text-base",
        )}
        aria-hidden
      >
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
        className={cn(
          "object-contain object-center drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]",
          density === "browse" ? "max-h-[78%] max-w-[88%]" : "max-h-full max-w-[82%]",
        )}
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
  density = "browse",
  compact,
}: {
  set: CatalogSetTileModel;
  selected?: boolean;
  onSelect: () => void;
  density?: CatalogSetTileDensity;
  /** @deprecated Use density="sidebar" */
  compact?: boolean;
}) {
  const resolvedDensity: CatalogSetTileDensity = compact === true ? "sidebar" : density;
  const ambient = useCatalogAmbientOptional();
  const logo = set.images?.logo || set.images?.symbol;
  const cardCount = set.printedTotal ?? set.total;
  const isBrowse = resolvedDensity === "browse";

  const metaLine = isBrowse
    ? [cardCount != null ? `${cardCount} cards` : null, set.releaseDate ?? set.year]
        .filter(Boolean)
        .join(" · ")
    : [set.series, set.releaseDate ?? set.year, cardCount != null ? `${cardCount} cards` : null]
        .filter(Boolean)
        .join(" · ");

  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={() =>
        ambient?.setHoverSet({ id: set.id, name: set.name, imageUrl: logo ?? undefined })
      }
      onMouseLeave={() => ambient?.setHoverSet(null)}
      onFocus={() =>
        ambient?.setHoverSet({ id: set.id, name: set.name, imageUrl: logo ?? undefined })
      }
      onBlur={() => ambient?.setHoverSet(null)}
      className={cn(
        "group flex h-full w-full flex-col rounded-lg border text-left transition touch-manipulation",
        isBrowse ? "p-1" : resolvedDensity === "sidebar" ? "p-1.5" : "p-2",
        selected
          ? "border-amber-400/50 bg-amber-400/[0.08] shadow-[0_0_0_1px_rgba(251,191,36,0.35),0_6px_16px_-10px_rgba(251,191,36,0.28)]"
          : "border-white/10 bg-gradient-to-b from-white/[0.05] to-[#070b10]/95 hover:border-amber-300/28 hover:from-white/[0.07]",
      )}
    >
      <SetLogoMark name={set.name} logoUrl={logo} density={resolvedDensity} />
      <div className={cn("min-w-0", isBrowse ? "mt-0.5 px-0.5 pb-0.5" : "mt-1 flex-1")}>
        <p
          className={cn(
            "font-semibold leading-tight text-slate-100",
            isBrowse
              ? "line-clamp-2 text-[9px] sm:text-[10px]"
              : resolvedDensity === "sidebar"
                ? "line-clamp-2 text-[10px]"
                : "line-clamp-2 text-[11px] sm:text-xs",
          )}
        >
          {set.name}
        </p>
        {set.badge && !isBrowse ? (
          <span className="mt-0.5 inline-flex rounded bg-white/8 px-1 py-px text-[7px] font-bold uppercase tracking-wide text-amber-200/80">
            {set.badge}
          </span>
        ) : null}
        {metaLine ? (
          <p
            className={cn(
              "text-slate-500",
              isBrowse
                ? "mt-0.5 line-clamp-1 text-[7px] leading-tight sm:text-[8px]"
                : resolvedDensity === "sidebar"
                  ? "mt-0.5 line-clamp-2 text-[8px] leading-tight"
                  : "mt-0.5 line-clamp-2 text-[9px] leading-snug",
            )}
          >
            {metaLine}
          </p>
        ) : null}
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
