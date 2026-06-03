"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatSlabzUsd } from "@/lib/slabz/display";
import {
  getSlabzPackArtMeta,
  resolveSlabzPackArtCandidates,
  slabzPackMediaProxyUrl,
  SLABZ_BRAND_LOGO_URL,
  type SlabzPackTier,
} from "@/lib/slabz/pack-art";
import type { SlabzPack } from "@/lib/slabz/types";
import { cn } from "@/lib/cn";

const TIER_LABEL: Record<SlabzPackTier, string> = {
  starter: "Starter",
  standard: "Mystery",
  premium: "Premium",
  elite: "Elite",
  onepiece: "One Piece",
  sealed: "Sealed",
  unknown: "Pack",
};

export function SlabzPackVisual({
  pack,
  size = "card",
  className,
  /** Full-bleed rip animation — shows pack GIF large with minimal foil chrome */
  variant = "tile",
}: {
  pack: SlabzPack;
  size?: "card" | "hero" | "showcase" | "thumb";
  className?: string;
  variant?: "tile" | "rip";
}) {
  const meta = getSlabzPackArtMeta(pack);
  const candidates = useMemo(() => resolveSlabzPackArtCandidates(pack), [pack]);
  const proxyUrl = useMemo(() => slabzPackMediaProxyUrl(pack), [pack]);

  const orderedSources = useMemo(() => {
    const list: string[] = [];
    const push = (u: string | null | undefined) => {
      const t = u?.trim();
      if (t && !list.includes(t)) list.push(t);
    };
    if (variant === "rip" && proxyUrl) push(proxyUrl);
    for (const c of candidates) push(c);
    return list;
  }, [variant, proxyUrl, candidates]);

  const [sourceIndex, setSourceIndex] = useState(0);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [exhausted, setExhausted] = useState(false);

  const activeSrc = exhausted ? null : (orderedSources[sourceIndex] ?? null);
  const showPhoto = Boolean(activeSrc) && imgLoaded && !exhausted;
  const isRip = variant === "rip";

  useEffect(() => {
    setSourceIndex(0);
    setImgLoaded(false);
    setExhausted(false);
  }, [pack.id, pack.imageUrl, pack.ccPackType, orderedSources.join("|")]);

  const onImageError = useCallback(() => {
    setImgLoaded(false);
    setSourceIndex((i) => {
      if (i + 1 < orderedSources.length) return i + 1;
      setExhausted(true);
      return i;
    });
  }, [orderedSources.length]);

  const dims =
    size === "showcase"
      ? isRip
        ? "h-[16rem] w-[11rem] sm:h-[20rem] sm:w-[13.5rem] md:h-[22rem] md:w-[15rem]"
        : "h-[12.5rem] w-[8.5rem] sm:h-[14rem] sm:w-[9.5rem]"
      : size === "hero"
        ? "h-[10.5rem] w-[7.25rem] sm:h-[11.5rem] sm:w-[8rem]"
        : size === "thumb"
          ? "h-14 w-11 sm:h-16 sm:w-12"
          : "h-[8.75rem] w-[6.25rem] sm:h-[9.5rem] sm:w-[6.75rem]";

  return (
    <div
      className={cn(
        "sc-slabz-pack-visual relative mx-auto shrink-0 overflow-hidden rounded-xl ring-1 ring-white/12",
        dims,
        meta.glowClass,
        isRip && "sc-slabz-pack-visual--rip",
        className,
      )}
    >
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br",
          meta.foilClass,
          !showPhoto && "sc-slabz-pack-visual__foil",
          isRip && showPhoto && "opacity-30",
        )}
      />
      {!isRip || !showPhoto ? (
        <div
          className={cn(
            "pointer-events-none absolute inset-0 opacity-80 bg-gradient-to-tr",
            meta.accentClass,
            "mix-blend-screen",
            isRip && showPhoto && "opacity-35",
          )}
        />
      ) : null}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/20 to-transparent" />

      {!showPhoto ? (
        <div
          className={cn(
            "relative flex h-full flex-col items-center justify-between px-2 py-2.5",
            isRip && "justify-center gap-3 py-4",
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={SLABZ_BRAND_LOGO_URL}
            alt=""
            className={cn(
              "object-contain opacity-90 drop-shadow",
              isRip ? "h-6 w-auto sm:h-7" : size === "thumb" ? "h-3 w-auto" : "h-4 w-auto sm:h-5",
            )}
          />
          {!isRip ? (
            <>
              <div className="text-center">
                <p
                  className={cn(
                    "font-bold uppercase tracking-[0.18em] text-white/90",
                    size === "thumb" ? "text-[6px]" : "text-[8px] sm:text-[9px]",
                  )}
                >
                  {TIER_LABEL[meta.tier]}
                </p>
                {size !== "thumb" ? (
                  <p
                    className={cn(
                      "mt-1 font-mono font-bold tabular-nums text-white",
                      size === "showcase" ? "text-xl sm:text-2xl" : "text-sm",
                    )}
                  >
                    {formatSlabzUsd(pack.priceCents)}
                  </p>
                ) : null}
              </div>
              <p
                className={cn(
                  "max-w-full truncate text-center font-semibold text-white/75",
                  size === "thumb" ? "text-[6px]" : "text-[8px]",
                )}
              >
                {pack.name}
              </p>
            </>
          ) : (
            <div className="text-center px-1">
              <p className="text-[10px] font-semibold text-white/90 sm:text-xs">{pack.name}</p>
              <p className="mt-1 font-mono text-lg font-bold text-white sm:text-xl">
                {formatSlabzUsd(pack.priceCents)}
              </p>
              {pack.description ? (
                <p className="mt-2 line-clamp-3 text-[9px] leading-snug text-white/55 sm:text-[10px]">
                  {pack.description}
                </p>
              ) : null}
              {orderedSources.length > 0 && !exhausted ? (
                <p className="mt-3 text-[8px] uppercase tracking-wider text-cyan-300/70 animate-pulse">
                  Loading pack art…
                </p>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      {activeSrc && !exhausted ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={activeSrc}
          src={activeSrc}
          alt={pack.name}
          className={cn(
            "absolute inset-0 transition-opacity duration-500",
            isRip
              ? "h-full w-full object-cover object-center p-0"
              : "h-full w-full object-contain p-1",
            showPhoto ? "opacity-100" : "opacity-0",
            isRip && showPhoto && "sc-slabz-pack-visual__rip-gif",
          )}
          onLoad={() => setImgLoaded(true)}
          onError={onImageError}
        />
      ) : null}
    </div>
  );
}
