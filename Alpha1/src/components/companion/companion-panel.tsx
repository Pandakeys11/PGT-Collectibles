"use client";

import { useState } from "react";
import { AuthControls } from "@/components/auth/auth-controls";
import { AnimatePresence, motion } from "framer-motion";
import {
  Apple,
  ChevronDown,
  ChevronUp,
  Dumbbell,
  Heart,
  Loader2,
  Moon,
  Sparkles,
  Swords,
} from "lucide-react";
import { CompanionStatBar } from "@/components/companion/companion-stat-bar";
import { PokeballGrid } from "@/components/companion/pokeball-grid";
import { PokemonSprite } from "@/components/companion/pokemon-sprite";
import { RevealOverlay } from "@/components/companion/reveal-overlay";
import type { CompanionController } from "@/hooks/use-companion";
import { getCompanionPokemon } from "@/lib/companion/pokemon-roster";
import { ACTION_META } from "@/lib/companion/game-engine";
import { saveCompanionLocal } from "@/lib/companion/client-storage";
import { parsePersistedRow } from "@/lib/companion/game-engine";
import type { CompanionActionId } from "@/lib/companion/schemas";
import { useAuth } from "@clerk/nextjs";
import { cn } from "@/lib/cn";

const ACTIONS: Array<{ id: CompanionActionId; icon: typeof Apple }> = [
  { id: "feed", icon: Apple },
  { id: "play", icon: Sparkles },
  { id: "train", icon: Dumbbell },
  { id: "battle", icon: Swords },
  { id: "rest", icon: Moon },
];

function formatCooldown(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export type CompanionPanelProps = CompanionController & {
  layout?: "sidebar" | "mobile";
};

export function CompanionPanel({
  layout = "sidebar",
  state,
  loading,
  busy,
  error,
  isSignedIn,
  hatch,
  runAction,
  claimTask,
  setError,
}: CompanionPanelProps) {
  const { userId } = useAuth();
  const isMobile = layout === "mobile";
  const [expanded, setExpanded] = useState(true);
  const [reveal, setReveal] = useState<{
    name: string;
    id: number;
    slug: string;
    era: string;
    tier: string;
  } | null>(null);
  const [hatching, setHatching] = useState(false);

  const showBody = isMobile || expanded;

  const handlePickBall = async () => {
    setHatching(true);
    setError(null);
    const result = await hatch();
    setHatching(false);
    if (result) {
      setReveal({
        name: result.name,
        id: result.id,
        slug: result.slug,
        era: result.era,
        tier: result.tier,
      });
    }
  };

  const closeReveal = () => {
    setReveal(null);
    if (state?.hatched && userId) {
      const row = parsePersistedRow({
        pokemonId: state.pokemonId,
        pokemonName: state.pokemonName,
        pokemonSlug: state.pokemonSlug,
        pokemonTier: state.pokemonTier,
        pokemonEra: state.pokemonEra,
        hatchedAt: state.hatchedAt,
        level: state.level,
        xp: state.xp,
        hunger: state.hunger,
        energy: state.energy,
        mood: state.mood,
        lastTickAt: state.lastTickAt,
      });
      if (row) saveCompanionLocal(userId, row);
    }
  };

  const inner = (
    <div className={cn("space-y-4", isMobile ? "pt-1" : "mt-3 space-y-3")}>
      {!isSignedIn ? (
        <div
          className={cn(
            "rounded-lg border border-dashed border-white/12 text-center",
            isMobile ? "px-4 py-8" : "px-3 py-4",
          )}
        >
          <p className={cn("text-slate-400", isMobile ? "mb-4 text-sm" : "mb-3 text-xs")}>
            Sign in to hatch and care for your partner.
          </p>
          <AuthControls redirectUrl="/scanner" />
        </div>
      ) : loading ? (
        <div
          className={cn(
            "flex items-center justify-center gap-2 text-slate-500",
            isMobile ? "py-16 text-sm" : "py-8 text-xs",
          )}
        >
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading partner…
        </div>
      ) : !state?.hatched ? (
        <>
          <p className={cn("leading-relaxed text-slate-400", isMobile ? "text-sm" : "text-[11px]")}>
            Pick any Poké Ball — each reveal rolls a random partner from starters, Eeveelutions, and
            legendaries.
          </p>
          <PokeballGrid
            disabled={busy || hatching}
            size={isMobile ? "large" : "default"}
            onPick={() => void handlePickBall()}
          />
          {hatching ? (
            <p className="flex items-center justify-center gap-2 text-sm text-energy-electric-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Revealing…
            </p>
          ) : null}
        </>
      ) : (
        <>
          <div
            className={cn(
              "flex items-center gap-3 rounded-lg border border-white/10 bg-black/30",
              isMobile ? "p-4" : "p-2",
            )}
          >
            <div
              className={cn(
                "grid shrink-0 place-items-center rounded-xl bg-gradient-to-b from-energy-fairy-1/25 to-transparent",
                isMobile ? "h-24 w-24" : "h-16 w-16 rounded-lg",
              )}
            >
              {state.pokemonId && state.pokemonSlug && state.pokemonName ? (
                <PokemonSprite
                  nationalId={state.pokemonId}
                  slug={state.pokemonSlug}
                  name={state.pokemonName}
                  types={getCompanionPokemon(state.pokemonId)?.types ?? []}
                  display="animated"
                  size={isMobile ? "lg" : "sm"}
                />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className={cn("truncate font-semibold text-white", isMobile && "text-lg")}>
                {state.pokemonName}
              </p>
              <p className={cn("uppercase text-slate-500", isMobile ? "text-xs" : "text-[10px]")}>
                Lv {state.level} · {state.moodLabel}
                {state.pokemonEra ? ` · ${state.pokemonEra}` : ""}
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full bg-energy-fairy-1 transition-all duration-500"
                  style={{
                    width: `${Math.round((state.xp / Math.max(1, state.xpToNext)) * 100)}%`,
                  }}
                />
              </div>
              <p className={cn("mt-1 font-mono text-slate-500", isMobile ? "text-xs" : "text-[9px]")}>
                {state.xp}/{state.xpToNext} XP
              </p>
            </div>
            <Heart className={cn("shrink-0 text-energy-fairy-2", isMobile ? "h-6 w-6" : "h-4 w-4")} />
          </div>

          <div className={cn("space-y-2", isMobile && "space-y-3")}>
            <CompanionStatBar label="Hunger" value={state.hunger} tone="hunger" />
            <CompanionStatBar label="Energy" value={state.energy} tone="energy" />
            <CompanionStatBar label="Mood" value={state.mood} tone="mood" />
          </div>

          <div className={cn("grid gap-2", isMobile ? "grid-cols-5" : "grid-cols-5 gap-1")}>
            {ACTIONS.map(({ id, icon: Icon }) => {
              const cd = formatCooldown(state.actionCooldowns[id]);
              return (
                <button
                  key={id}
                  type="button"
                  disabled={busy || Boolean(cd)}
                  onClick={() => void runAction(id)}
                  title={cd ? `${ACTION_META[id].label} · ${cd}` : ACTION_META[id].label}
                  className={cn(
                    "flex touch-manipulation flex-col items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] font-semibold text-slate-300 transition",
                    "hover:border-energy-fairy-1/35 hover:text-energy-fairy-3 active:scale-[0.98] disabled:opacity-40",
                    isMobile ? "min-h-[3.25rem] py-2.5 text-[10px]" : "py-2 text-[9px]",
                  )}
                >
                  <Icon className={isMobile ? "h-5 w-5" : "h-3.5 w-3.5"} />
                  {ACTION_META[id].label}
                  {cd ? <span className="font-mono text-[8px] text-slate-600">{cd}</span> : null}
                </button>
              );
            })}
          </div>

          <div className={cn("space-y-2", isMobile ? "max-h-none" : "max-h-32 overflow-y-auto pr-0.5")}>
            <p className={cn("font-semibold uppercase text-slate-500", isMobile ? "text-xs" : "text-[9px]")}>
              Tasks
            </p>
            {state.tasks.map((task) => (
              <div
                key={task.id}
                className={cn(
                  "flex items-center gap-3 rounded-lg border border-white/[0.07] bg-[#05080c]",
                  isMobile ? "px-3 py-3" : "px-2 py-1.5",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className={cn("text-slate-300", isMobile ? "text-sm" : "truncate text-[10px]")}>
                    {task.label}
                  </p>
                  <p className={cn("font-mono text-slate-600", isMobile ? "text-xs" : "text-[9px]")}>
                    {task.progress}/{task.goal} · +{task.rewardXp} XP
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy || !task.complete || task.claimed}
                  onClick={() => void claimTask(task.id)}
                  className={cn(
                    "shrink-0 touch-manipulation rounded-md px-3 py-2 font-bold uppercase transition active:scale-[0.98]",
                    isMobile ? "text-xs" : "px-2 py-1 text-[9px]",
                    task.claimed
                      ? "border border-white/10 text-slate-600"
                      : task.complete
                        ? "border border-emerald-300/40 bg-emerald-400/15 text-emerald-200"
                        : "border border-white/10 text-slate-500",
                  )}
                >
                  {task.claimed ? "Done" : task.complete ? "Claim" : task.window}
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {error ? (
        <p className={cn("text-amber-300/90", isMobile ? "text-sm" : "text-[10px]")}>{error}</p>
      ) : null}
    </div>
  );

  return (
    <>
      {isMobile ? (
        inner
      ) : (
        <section className="rounded-lg border border-energy-fairy-1/25 bg-gradient-to-b from-energy-fairy-1/10 to-panel p-3">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex w-full items-center justify-between gap-2 text-left"
          >
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-energy-fairy-2">PGT Partner</p>
              <p className="text-[11px] text-slate-500">Fan-made Tamagotchi care</p>
            </div>
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-slate-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-500" />
            )}
          </button>
          <AnimatePresence initial={false}>
            {showBody ? (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                {inner}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </section>
      )}

      <RevealOverlay
        open={Boolean(reveal)}
        name={reveal?.name ?? ""}
        nationalId={reveal?.id ?? 0}
        slug={reveal?.slug ?? ""}
        era={reveal?.era ?? state?.pokemonEra ?? ""}
        tier={reveal?.tier ?? state?.pokemonTier ?? ""}
        onDone={closeReveal}
      />
    </>
  );
}
