"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useMemo, useState } from "react";
import { artworkSpriteSources } from "@/lib/companion/sprites";
import { ENERGY_UI } from "@/lib/energy-ui";
import type { EnergyType } from "@/lib/energy-theme";
import { cn } from "@/lib/cn";

function primaryEnergy(types: string[]): EnergyType {
  const t = types[0]?.toLowerCase();
  const allowed: EnergyType[] = [
    "fire",
    "water",
    "electric",
    "grass",
    "psychic",
    "dark",
    "metal",
    "fighting",
    "fairy",
    "dragon",
  ];
  return allowed.includes(t as EnergyType) ? (t as EnergyType) : "psychic";
}

/**
 * Option C — official artwork with motion/holo treatment (battle + portrait fallbacks).
 */
export function PokemonArtworkPresent({
  nationalId,
  name,
  types = [],
  variant = "battle",
  className,
  size = "md",
}: {
  nationalId: number;
  name: string;
  types?: string[];
  variant?: "battle" | "portrait";
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const reduceMotion = useReducedMotion();
  const sources = useMemo(() => artworkSpriteSources(nationalId), [nationalId]);
  const [index, setIndex] = useState(0);
  const energy = primaryEnergy(types);
  const ui = ENERGY_UI[energy];

  const frameClass =
    size === "lg"
      ? "h-28 w-28 sm:h-32 sm:w-32"
      : size === "sm"
        ? "h-14 w-14"
        : "h-20 w-20";

  const isBattle = variant === "battle";

  return (
    <motion.div
      className={cn("relative grid place-items-center", frameClass, className)}
      animate={
        reduceMotion
          ? undefined
          : isBattle
            ? { y: [0, -10, 0], scale: [1, 1.04, 1] }
            : { y: [0, -5, 0] }
      }
      transition={
        reduceMotion
          ? undefined
          : { duration: isBattle ? 2.8 : 3.6, repeat: Infinity, ease: "easeInOut" }
      }
    >
      <span
        className={cn(
          "pointer-events-none absolute inset-[-18%] rounded-full opacity-90",
          ui.pillar,
        )}
        aria-hidden
      />
      <span
        className={cn(
          "pointer-events-none absolute inset-0 rounded-2xl border-2",
          ui.ring,
          isBattle && ui.glow,
        )}
        aria-hidden
      />
      <span
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl opacity-30"
        aria-hidden
      >
        <span className="companion-artwork-shimmer absolute inset-0 bg-[linear-gradient(105deg,transparent_42%,rgb(255_255_255/0.35)_50%,transparent_58%)] bg-[length:220%_100%]" />
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={sources[index]}
        alt={name}
        className={cn(
          "relative z-[1] h-[88%] w-[88%] object-contain object-bottom drop-shadow-[0_12px_28px_rgba(0,0,0,0.55)]",
          isBattle && "brightness-110 contrast-[1.05] saturate-[1.12]",
        )}
        onError={() => {
          if (index < sources.length - 1) setIndex((i) => i + 1);
        }}
        loading="lazy"
      />
      {isBattle ? (
        <span className="pointer-events-none absolute bottom-0 left-1/2 z-0 h-3 w-[70%] -translate-x-1/2 rounded-full bg-black/45 blur-md" />
      ) : null}
    </motion.div>
  );
}
