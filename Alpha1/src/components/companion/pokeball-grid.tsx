"use client";

import { useMemo } from "react";
import { Pokeball } from "@/components/companion/pokeball";
import { shufflePokeballGrid } from "@/lib/companion/pokemon-roster";
import { cn } from "@/lib/cn";

export function PokeballGrid({
  disabled,
  onPick,
  size = "default",
}: {
  disabled?: boolean;
  onPick: () => void;
  size?: "default" | "large";
}) {
  const order = useMemo(() => shufflePokeballGrid(), []);
  const large = size === "large";

  return (
    <div className={cn("grid grid-cols-3", large ? "gap-3" : "gap-2")}>
      {order.map((slot) => (
        <button
          key={slot}
          type="button"
          disabled={disabled}
          onClick={onPick}
          className={cn(
            large ? "group rounded-xl border border-white/10 bg-[#070b10]/90 p-3 transition" : "group rounded-lg border border-white/10 bg-[#070b10]/90 p-2 transition",
            "hover:border-cyan-300/40 hover:bg-cyan-300/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50",
            disabled && "pointer-events-none opacity-50",
          )}
          aria-label={`Choose Poké Ball ${slot + 1}`}
        >
          <Pokeball pulse className={cn("mx-auto", large && "max-w-[5.5rem]")} />
        </button>
      ))}
    </div>
  );
}
