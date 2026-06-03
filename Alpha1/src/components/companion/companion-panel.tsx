"use client";

import { useCallback, useState } from "react";
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
  RefreshCw,
  Sparkles,
  Swords,
} from "lucide-react";
import { CompanionBattleArena } from "@/components/companion/companion-battle-arena";
import { CompanionQuestBoard } from "@/components/companion/companion-quest-board";
import {
  CompanionTcgFrame,
  companionStageBadge,
} from "@/components/companion/companion-tcg-frame";
import {
  createBattle,
  getBattleBlockReason,
  type BattleState,
} from "@/lib/companion/battle-engine";
import { MAX_STARTER_REROLLS } from "@/lib/companion/game-engine";
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
  layout?: "sidebar" | "mobile" | "tcg";
  onDismiss?: () => void;
};

export function CompanionPanel({
  layout = "sidebar",
  onDismiss,
  state,
  loading,
  busy,
  error,
  isSignedIn,
  hatch,
  rerollStarter,
  runAction,
  claimTask,
  setError,
}: CompanionPanelProps) {
  const { userId } = useAuth();
  const isTcg = layout === "tcg" || layout === "mobile";
  const isSidebar = layout === "sidebar";
  const [expanded, setExpanded] = useState(true);
  const [reveal, setReveal] = useState<{
    name: string;
    id: number;
    slug: string;
    era: string;
    tier: string;
  } | null>(null);
  const [hatching, setHatching] = useState(false);
  const [pickingAgain, setPickingAgain] = useState(false);
  const [showRerollGrid, setShowRerollGrid] = useState(false);
  const [battle, setBattle] = useState<BattleState | null>(null);

  const showBody = isSidebar ? expanded : true;
  const rerollsRemaining = state?.starterRerollsRemaining ?? 0;

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

  const handlePickAgain = async () => {
    setPickingAgain(true);
    setError(null);
    const result = await rerollStarter();
    setPickingAgain(false);
    setShowRerollGrid(false);
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

  const tryStartBattle = useCallback(() => {
    if (battle || busy) return;
    const pokemon = state?.pokemonId ? getCompanionPokemon(state.pokemonId) : null;
    if (!state?.hatched || !pokemon) return;
    const block = getBattleBlockReason(state);
    if (block) {
      setError(block);
      return;
    }
    setError(null);
    setBattle(createBattle(pokemon, state.level));
  }, [battle, busy, state, setError]);

  const finishBattle = useCallback(
    (_won: boolean) => {
      setBattle(null);
      void runAction("battle");
    },
    [runAction],
  );

  const handleAction = useCallback(
    (id: CompanionActionId) => {
      if (id === "battle" && isTcg && state?.hatched) {
        tryStartBattle();
        return;
      }
      void runAction(id);
    },
    [isTcg, runAction, state?.hatched, tryStartBattle],
  );

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
        starterRerollsUsed: state.starterRerollsUsed,
      });
      if (row) saveCompanionLocal(userId, row);
    }
  };

  const xpPercent = state?.hatched
    ? Math.round((state.xp / Math.max(1, state.xpToNext)) * 100)
    : 0;

  const tcgAbilityText = !isSignedIn
    ? "Sign in to hatch your partner Pokémon."
    : loading
      ? "Summoning your partner from the vault…"
      : !state?.hatched
        ? "Choose a Poké Ball — roll a starter, Eeveelution, or legendary."
        : `${state.moodLabel} — care for your partner while you scan and research cards.`;

  const tcgStatusHint = state?.hatched
    ? `${state.xp}/${state.xpToNext} XP to next level`
    : hatching
      ? "Hatching in progress…"
      : null;

  const tcgArt = !isSignedIn ? (
    <div className="flex w-full flex-col items-center gap-3 px-2 py-2 text-center">
      <p className="text-[10px] leading-snug text-slate-400">Sign in to unlock your partner card.</p>
      <AuthControls />
    </div>
  ) : loading ? (
    <div className="flex flex-col items-center gap-2 py-4 text-slate-400">
      <Loader2 className="h-7 w-7 animate-spin text-fuchsia-300" />
      <p className="text-[10px]">Loading partner…</p>
    </div>
  ) : !state?.hatched ? (
    <div className="w-full space-y-2">
      <PokeballGrid disabled={busy || hatching} size="default" onPick={() => void handlePickBall()} />
      {hatching ? (
        <p className="flex items-center justify-center gap-2 text-[10px] text-fuchsia-200">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Revealing…
        </p>
      ) : null}
    </div>
  ) : state.pokemonId && state.pokemonSlug && state.pokemonName ? (
    <div className="flex w-full flex-col items-center justify-end">
      <PokemonSprite
        nationalId={state.pokemonId}
        slug={state.pokemonSlug}
        name={state.pokemonName}
        types={getCompanionPokemon(state.pokemonId)?.types ?? []}
        display="animated"
        size="lg"
      />
    </div>
  ) : null;

  const tcgFooter =
    isSignedIn && !loading && state?.hatched ? (
      <>
        <p className="mb-1.5 text-[8px] font-bold uppercase tracking-[0.14em] text-slate-500">
          Care stats
        </p>
        <div className="space-y-1.5">
          <CompanionStatBar label="Hunger" value={state.hunger} tone="hunger" />
          <CompanionStatBar label="Energy" value={state.energy} tone="energy" />
          <CompanionStatBar label="Mood" value={state.mood} tone="mood" />
        </div>

        <p className="mb-1.5 mt-2.5 text-[8px] font-bold uppercase tracking-[0.14em] text-slate-500">
          Partner actions
        </p>
        <div className="grid grid-cols-5 gap-1">
          {ACTIONS.map(({ id, icon: Icon }) => {
            const cd = formatCooldown(state.actionCooldowns[id]);
            return (
              <button
                key={id}
                type="button"
                disabled={busy || Boolean(cd) || Boolean(battle)}
                onClick={() => handleAction(id)}
                title={cd ? `${ACTION_META[id].label} · ${cd}` : ACTION_META[id].label}
                className={cn(
                  "sc-companion-tcg-action flex touch-manipulation flex-col items-center justify-center gap-0.5 rounded-md border border-white/10 bg-white/[0.04] py-1.5 text-[8px] font-semibold text-slate-300 transition",
                  "hover:border-fuchsia-400/35 hover:text-fuchsia-100 active:scale-[0.97] disabled:opacity-40",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="leading-none">{ACTION_META[id].label}</span>
                {cd ? <span className="font-mono text-[7px] text-slate-600">{cd}</span> : null}
              </button>
            );
          })}
        </div>

        {rerollsRemaining > 0 ? (
          <div className="mt-2.5 rounded-md border border-white/8 bg-black/30 p-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[9px] text-slate-500">
                {rerollsRemaining}/{MAX_STARTER_REROLLS} rerolls
              </p>
              <button
                type="button"
                disabled={busy || pickingAgain}
                onClick={() => setShowRerollGrid((v) => !v)}
                className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-1 text-[8px] font-semibold text-slate-300"
              >
                <RefreshCw className={cn("h-3 w-3", pickingAgain && "animate-spin")} />
                Reroll
              </button>
            </div>
            {showRerollGrid ? (
              <div className="mt-2 space-y-1.5">
                <PokeballGrid
                  disabled={busy || pickingAgain}
                  size="default"
                  onPick={() => void handlePickAgain()}
                />
                {pickingAgain ? (
                  <p className="flex items-center justify-center gap-1 text-[9px] text-slate-500">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Rolling…
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <p className="mb-1.5 mt-2.5 text-[8px] font-bold uppercase tracking-[0.14em] text-slate-500">
          Partner quests
        </p>
        <div className="max-h-40 overflow-y-auto scanner-chat-scrollbar">
          <CompanionQuestBoard
            tasks={state.tasks}
            busy={busy}
            isMobile
            onClaim={(taskId) => void claimTask(taskId)}
          />
        </div>
      </>
    ) : null;

  const sidebarInner = (
    <div className={cn("space-y-4", isSidebar ? "mt-3 space-y-3" : "pt-1")}>
      {!isSignedIn ? (
        <div className="rounded-lg border border-dashed border-white/12 px-3 py-4 text-center">
          <p className="mb-3 text-xs text-slate-400">Sign in to hatch and care for your partner.</p>
          <AuthControls />
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading partner…
        </div>
      ) : !state?.hatched ? (
        <>
          <p className="text-[11px] leading-relaxed text-slate-400">
            Pick any Poké Ball — each reveal rolls a random partner from starters, Eeveelutions, and
            legendaries.
          </p>
          <PokeballGrid disabled={busy || hatching} size="default" onPick={() => void handlePickBall()} />
          {hatching ? (
            <p className="flex items-center justify-center gap-2 text-sm text-energy-electric-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Revealing…
            </p>
          ) : null}
        </>
      ) : (
        <>
          <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/30 p-2">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-gradient-to-b from-energy-fairy-1/25 to-transparent">
              {state.pokemonId && state.pokemonSlug && state.pokemonName ? (
                <PokemonSprite
                  nationalId={state.pokemonId}
                  slug={state.pokemonSlug}
                  name={state.pokemonName}
                  types={getCompanionPokemon(state.pokemonId)?.types ?? []}
                  display="animated"
                  size="sm"
                />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-white">{state.pokemonName}</p>
              <p className="text-[10px] uppercase text-slate-500">
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
              <p className="mt-1 font-mono text-[9px] text-slate-500">
                {state.xp}/{state.xpToNext} XP
              </p>
            </div>
            <Heart className="h-4 w-4 shrink-0 text-energy-fairy-2" />
          </div>

          {rerollsRemaining > 0 ? (
            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold text-slate-200">Starter pick</p>
                  <p className="text-[10px] text-slate-500">
                    {rerollsRemaining} of {MAX_STARTER_REROLLS} rerolls left
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy || pickingAgain}
                  onClick={() => setShowRerollGrid((v) => !v)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-white/12 bg-white/[0.04] px-2 py-1.5 text-[10px] font-semibold text-slate-200"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", pickingAgain && "animate-spin")} />
                  Pick again
                </button>
              </div>
              {showRerollGrid ? (
                <div className="mt-3 space-y-2">
                  <PokeballGrid
                    disabled={busy || pickingAgain}
                    size="default"
                    onPick={() => void handlePickAgain()}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-2">
            <CompanionStatBar label="Hunger" value={state.hunger} tone="hunger" />
            <CompanionStatBar label="Energy" value={state.energy} tone="energy" />
            <CompanionStatBar label="Mood" value={state.mood} tone="mood" />
          </div>

          <div className="grid grid-cols-5 gap-1">
            {ACTIONS.map(({ id, icon: Icon }) => {
              const cd = formatCooldown(state.actionCooldowns[id]);
              return (
                <button
                  key={id}
                  type="button"
                  disabled={busy || Boolean(cd)}
                  onClick={() => handleAction(id)}
                  className="flex flex-col items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] py-2 text-[9px] font-semibold text-slate-300 disabled:opacity-40"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {ACTION_META[id].label}
                </button>
              );
            })}
          </div>

          <div className="max-h-64 overflow-y-auto scanner-chat-scrollbar">
            <CompanionQuestBoard
              tasks={state.tasks}
              busy={busy}
              onClaim={(taskId) => void claimTask(taskId)}
            />
          </div>
        </>
      )}

      {error ? <p className="text-[10px] text-amber-300/90">{error}</p> : null}
    </div>
  );

  return (
    <>
      {isTcg ? (
        <div
          className={cn(
            "sc-companion-tcg-shell flex w-full justify-center py-1",
            battle && "sc-companion-tcg-shell--battle",
          )}
        >
          <AnimatePresence mode="wait">
            {battle ? (
              <motion.div
                key="companion-battle"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.22 }}
                className="w-full"
              >
                <CompanionBattleArena initial={battle} onFinish={finishBattle} />
              </motion.div>
            ) : (
              <motion.div
                key="companion-card"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.22 }}
                className="w-full"
              >
                <CompanionTcgFrame
                  xpPercent={xpPercent}
                  name={state?.hatched && state.pokemonName ? state.pokemonName : "Partner Egg"}
                  lineLabel={
                    state?.hatched
                      ? `Lv ${state.level} · ${state.moodLabel}${state.pokemonEra ? ` · ${state.pokemonEra}` : ""}`
                      : "Unhatched · pick a ball"
                  }
                  stageBadge={
                    state?.hatched
                      ? companionStageBadge(state.level, state.pokemonTier)
                      : "EGG"
                  }
                  abilityText={tcgAbilityText}
                  statusHint={tcgStatusHint}
                  rare={state?.pokemonTier === "legendary"}
                  onDismiss={onDismiss}
                  art={tcgArt}
                  footer={tcgFooter}
                />
              </motion.div>
            )}
          </AnimatePresence>
          {error ? (
            <p className="mx-auto mt-2 max-w-[20rem] text-center text-[10px] text-amber-300/90">
              {error}
            </p>
          ) : null}
        </div>
      ) : (
        <section className="rounded-lg border border-energy-fairy-1/25 bg-gradient-to-b from-energy-fairy-1/10 to-panel p-3">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex w-full items-center justify-between gap-2 text-left"
          >
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-energy-fairy-2">
                PGT Partner
              </p>
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
                {sidebarInner}
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
