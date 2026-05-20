"use client";

import { useEffect, useMemo, useState } from "react";
import { useSpriteManifest } from "@/hooks/use-sprite-manifest";
import { PokemonArtworkPresent } from "@/components/companion/pokemon-artwork-present";
import { animatedSpriteSources } from "@/lib/companion/sprites";
import { cn } from "@/lib/cn";

export type PokemonSpriteDisplay = "animated" | "battle" | "artwork";

/**
 * Companion / scanner Pokémon visuals.
 * - animated: hosted (B) → Showdown (A) → artwork (C)
 * - battle: same chain; artwork uses battle motion variant
 * - artwork: Option C only
 */
export function PokemonSprite({
  nationalId,
  slug,
  name,
  types = [],
  size = "md",
  display = "animated",
  className,
}: {
  nationalId: number;
  slug: string;
  name: string;
  types?: string[];
  size?: "sm" | "md" | "lg";
  display?: PokemonSpriteDisplay;
  className?: string;
}) {
  const { ready: manifestReady } = useSpriteManifest();
  const sources = useMemo(
    () => (display === "artwork" ? [] : animatedSpriteSources(nationalId, slug)),
    [display, nationalId, slug],
  );
  const [index, setIndex] = useState(0);
  const [useArtwork, setUseArtwork] = useState(display === "artwork");

  useEffect(() => {
    setIndex(0);
    setUseArtwork(display === "artwork");
  }, [nationalId, slug, display, manifestReady]);

  const sizeClass =
    size === "lg" ? "h-28 w-28" : size === "sm" ? "h-14 w-14" : "h-20 w-20";

  if (useArtwork) {
    return (
      <PokemonArtworkPresent
        nationalId={nationalId}
        name={name}
        types={types}
        variant={display === "battle" ? "battle" : "portrait"}
        size={size}
        className={className}
      />
    );
  }

  const src = sources[index];
  if (!src) {
    return (
      <PokemonArtworkPresent
        nationalId={nationalId}
        name={name}
        types={types}
        variant={display === "battle" ? "battle" : "portrait"}
        size={size}
        className={className}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      className={cn(
        sizeClass,
        "object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.45)]",
        className,
      )}
      style={{ imageRendering: "pixelated" }}
      onError={() => {
        if (index < sources.length - 1) {
          setIndex((i) => i + 1);
          return;
        }
        if (display === "battle" || display === "animated") {
          setUseArtwork(true);
        }
      }}
      loading="lazy"
    />
  );
}
