"use client";

import { PokemonSprite } from "@/components/companion/pokemon-sprite";
import type { BattleFighter } from "@/lib/companion/battle-engine";
import { cn } from "@/lib/cn";

function hpColor(ratio: number): string {
  if (ratio > 0.5) return "bg-emerald-400";
  if (ratio > 0.2) return "bg-yellow-400";
  return "bg-rose-500";
}

export function CompanionBattleMiniCard({
  fighter,
  side,
  trainerLabel,
  subLabel,
  teamRocket,
  className,
}: {
  fighter: BattleFighter;
  side: "player" | "enemy";
  trainerLabel?: string;
  subLabel?: string;
  teamRocket?: boolean;
  className?: string;
}) {
  const hpRatio = fighter.maxHp > 0 ? fighter.hp / fighter.maxHp : 0;

  return (
    <article
      className={cn(
        "sc-companion-battle-card sc-scan-tcg-card overflow-hidden rounded-lg",
        side === "player" ? "sc-companion-battle-card--player" : "sc-companion-battle-card--enemy",
        teamRocket && side === "enemy" && "sc-companion-battle-card--rocket",
        className,
      )}
    >
      <div
        className={cn(
          "sc-companion-battle-card__header px-2 py-1 text-[8px] font-black uppercase tracking-wider",
          teamRocket && side === "enemy"
            ? "bg-gradient-to-r from-rose-700/90 via-slate-900 to-indigo-900/90 text-white"
            : side === "enemy"
              ? "bg-gradient-to-r from-rose-900/80 to-slate-900/90 text-rose-100"
              : "bg-gradient-to-r from-violet-700/80 to-fuchsia-900/70 text-violet-50",
        )}
      >
        {trainerLabel ?? (side === "player" ? "Your partner" : "Foe")}
        {subLabel ? (
          <span className="mt-0.5 block font-medium normal-case tracking-normal text-white/60">
            {subLabel}
          </span>
        ) : null}
      </div>
      <div className="sc-companion-battle-card__body flex gap-2 p-2">
        <div
          className={cn(
            "sc-companion-battle-card__art relative flex shrink-0 items-end justify-center overflow-hidden rounded-md border border-black/40 bg-black/50",
            side === "enemy" ? "h-14 w-14" : "h-16 w-16",
          )}
        >
          <span className="sc-scan-tcg-art-foil pointer-events-none opacity-60" aria-hidden />
          <PokemonSprite
            nationalId={fighter.pokemonId}
            slug={fighter.slug}
            name={fighter.name}
            types={fighter.types}
            display="animated"
            size="sm"
            className={cn(side === "enemy" && "scale-x-[-1]")}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-bold uppercase text-slate-100">{fighter.name}</p>
          <p className="text-[9px] text-slate-500">Lv {fighter.level}</p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="text-[8px] font-bold uppercase text-slate-500">HP</span>
            <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-black/50">
              <div
                className={cn("h-full transition-all duration-500", hpColor(hpRatio))}
                style={{ width: `${Math.max(0, hpRatio * 100)}%` }}
              />
            </div>
            <span className="font-mono text-[8px] tabular-nums text-slate-400">
              {fighter.hp}/{fighter.maxHp}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
