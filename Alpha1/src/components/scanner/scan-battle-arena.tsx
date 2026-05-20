"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Crosshair, HeartPulse, Shield, Sparkles, Swords, Trophy } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PokemonSprite } from "@/components/companion/pokemon-sprite";
import type { CompanionPokemon } from "@/lib/companion/pokemon-roster";
import { getCompanionPokemon, pickRandomCompanionPokemon } from "@/lib/companion/pokemon-roster";
import type { CompanionState } from "@/lib/companion/schemas";
import { cn } from "@/lib/cn";
import { ENERGY_UI } from "@/lib/energy-ui";
import { starterPrimaryEnergy } from "@/lib/scanner/workflow-starters";

type BattleTurn = "player" | "opponent" | "complete";
type Winner = "player" | "opponent" | null;
type PerkId = "focus_lens" | "guard_charm" | "berry_patch";

type BattleMove = {
  id: "quick" | "power" | "guard" | "scan";
  label: string;
  detail: string;
  power: number;
  accuracy: number;
  icon: typeof Swords;
};

type BattleState = {
  id: string;
  opponent: CompanionPokemon;
  playerHp: number;
  playerMaxHp: number;
  opponentHp: number;
  opponentMaxHp: number;
  turn: BattleTurn;
  winner: Winner;
  round: number;
  focus: boolean;
  shield: boolean;
  lastActor: "player" | "opponent" | null;
  lastHit: "player" | "opponent" | null;
  log: string[];
};

type BattleInventory = {
  wins: number;
  perks: Record<PerkId, number>;
};

const MOVES: BattleMove[] = [
  { id: "quick", label: "Quick Hit", detail: "Reliable chip damage", power: 14, accuracy: 0.96, icon: Swords },
  { id: "power", label: "Power Hit", detail: "Heavy swing, can miss", power: 24, accuracy: 0.74, icon: Crosshair },
  { id: "guard", label: "Guard", detail: "Brace for the next hit", power: 0, accuracy: 1, icon: Shield },
  { id: "scan", label: "Scan Pulse", detail: "Small hit and heal", power: 10, accuracy: 0.9, icon: Sparkles },
] as const;

const PERKS: Array<{
  id: PerkId;
  label: string;
  detail: string;
  icon: typeof Sparkles;
}> = [
  { id: "focus_lens", label: "Focus Lens", detail: "Boost next attack", icon: Crosshair },
  { id: "guard_charm", label: "Guard Charm", detail: "Block next hit", icon: Shield },
  { id: "berry_patch", label: "Berry Patch", detail: "Restore HP", icon: HeartPulse },
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function hpFor(level: number, mood: number, bonus = 0) {
  return 74 + level * 6 + Math.round(mood / 4) + bonus;
}

function playerFromState(state: CompanionState | null | undefined, fallback: CompanionPokemon | null) {
  if (state?.hatched && state.pokemonId && state.pokemonName && state.pokemonSlug) {
    const rosterMatch = getCompanionPokemon(state.pokemonId);
    if (rosterMatch) return rosterMatch;
    return {
      id: state.pokemonId,
      name: state.pokemonName,
      slug: state.pokemonSlug,
      tier: "starter",
      era: state.pokemonEra ?? "Partner",
      types: ["electric"],
    } satisfies CompanionPokemon;
  }
  return fallback;
}

function pickOpponent(playerId: number | null | undefined) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const opponent = pickRandomCompanionPokemon();
    if (opponent.id !== playerId) return opponent;
  }
  return pickRandomCompanionPokemon();
}

function createBattle(player: CompanionPokemon, state: CompanionState | null | undefined): BattleState {
  const level = Math.max(1, state?.level ?? 1);
  const mood = state?.mood ?? 62;
  const opponent = pickOpponent(player.id);
  const playerMaxHp = hpFor(level, mood);
  const opponentLevel = clamp(level + Math.floor(Math.random() * 3) - 1, 1, 100);
  const opponentMaxHp = hpFor(opponentLevel, 55, opponent.tier === "legendary" || opponent.tier === "mythical" ? 14 : 0);

  return {
    id: `${player.id}-${opponent.id}-${Date.now()}`,
    opponent,
    playerHp: playerMaxHp,
    playerMaxHp,
    opponentHp: opponentMaxHp,
    opponentMaxHp,
    turn: "player",
    winner: null,
    round: 1,
    focus: false,
    shield: false,
    lastActor: null,
    lastHit: null,
    log: [`A wild ${opponent.name} challenged the scan queue.`],
  };
}

function readInventory(storageKey: string): BattleInventory {
  if (typeof window === "undefined") return { wins: 0, perks: { focus_lens: 0, guard_charm: 0, berry_patch: 0 } };
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return { wins: 0, perks: { focus_lens: 0, guard_charm: 0, berry_patch: 0 } };
    const parsed = JSON.parse(raw) as Partial<BattleInventory>;
    return {
      wins: Number(parsed.wins ?? 0),
      perks: {
        focus_lens: Number(parsed.perks?.focus_lens ?? 0),
        guard_charm: Number(parsed.perks?.guard_charm ?? 0),
        berry_patch: Number(parsed.perks?.berry_patch ?? 0),
      },
    };
  } catch {
    return { wins: 0, perks: { focus_lens: 0, guard_charm: 0, berry_patch: 0 } };
  }
}

function writeInventory(storageKey: string, inventory: BattleInventory) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(inventory));
}

function HpBar({ value, max, tone }: { value: number; max: number; tone: "player" | "opponent" }) {
  const pct = max <= 0 ? 0 : clamp((value / max) * 100, 0, 100);
  return (
    <div className="mt-2 h-2 overflow-hidden rounded-full border border-white/10 bg-black/35">
      <motion.div
        className={cn("h-full rounded-full", tone === "player" ? "bg-energy-grass-2" : "bg-energy-fire-2")}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.28 }}
      />
    </div>
  );
}

export function ScanBattleArena({
  active,
  busy,
  progress,
  companionState,
  companionBusy,
  fallbackPokemon,
  onBattleReward,
}: {
  active: boolean;
  busy: boolean;
  progress: string | null;
  companionState: CompanionState | null;
  companionBusy: boolean;
  fallbackPokemon: CompanionPokemon | null;
  onBattleReward?: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const player = useMemo(
    () => playerFromState(companionState, fallbackPokemon),
    [companionState, fallbackPokemon],
  );
  const playerLevel = companionState?.level ?? 1;
  const storageKey = `pgt_scan_battle_${player?.id ?? "guest"}`;
  const [battle, setBattle] = useState<BattleState | null>(null);
  const [inventory, setInventory] = useState<BattleInventory>(() => readInventory(storageKey));
  const rewardedBattleRef = useRef<string | null>(null);
  const playerEnergy = player ? starterPrimaryEnergy(player) : "electric";
  const playerUi = ENERGY_UI[playerEnergy];

  useEffect(() => {
    setInventory(readInventory(storageKey));
  }, [storageKey]);

  const updateInventory = useCallback(
    (updater: (current: BattleInventory) => BattleInventory) => {
      setInventory((current) => {
        const next = updater(current);
        writeInventory(storageKey, next);
        return next;
      });
    },
    [storageKey],
  );

  const startBattle = useCallback(() => {
    if (!player) return;
    rewardedBattleRef.current = null;
    setBattle(createBattle(player, companionState));
  }, [companionState, player]);

  useEffect(() => {
    if (!active) return;
    if (!battle && player) startBattle();
  }, [active, battle, player, startBattle]);

  const appendLog = useCallback((line: string) => {
    setBattle((current) =>
      current
        ? {
            ...current,
            log: [line, ...current.log].slice(0, 4),
          }
        : current,
    );
  }, []);

  const runPlayerMove = (move: BattleMove) => {
    setBattle((current) => {
      if (!current || current.turn !== "player" || current.winner) return current;

      if (move.id === "guard") {
        return {
          ...current,
          shield: true,
          turn: "opponent",
          lastActor: "player",
          lastHit: null,
          log: [`${player?.name ?? "Partner"} braced for impact.`, ...current.log].slice(0, 4),
        };
      }

      const focusBoost = current.focus ? 0.14 : 0;
      const hit = Math.random() <= move.accuracy + focusBoost;
      const moodBoost = (companionState?.mood ?? 50) >= 75 ? 3 : 0;
      const energyBoost = (companionState?.energy ?? 50) >= 70 ? 3 : 0;
      const damage = hit
        ? clamp(move.power + playerLevel * 1.2 + moodBoost + energyBoost + (current.focus ? 8 : 0), 4, 48)
        : 0;
      const opponentHp = clamp(current.opponentHp - damage, 0, current.opponentMaxHp);
      const heal = move.id === "scan" && hit ? 7 : 0;
      const playerHp = clamp(current.playerHp + heal, 0, current.playerMaxHp);
      const winner = opponentHp <= 0 ? "player" : null;

      return {
        ...current,
        playerHp,
        opponentHp,
        focus: false,
        turn: winner ? "complete" : "opponent",
        winner,
        lastActor: "player",
        lastHit: hit ? "opponent" : null,
        log: [
          hit
            ? `${player?.name ?? "Partner"} used ${move.label} for ${damage} damage${heal ? " and recovered HP" : ""}.`
            : `${player?.name ?? "Partner"} used ${move.label}, but it missed.`,
          ...current.log,
        ].slice(0, 4),
      };
    });
  };

  useEffect(() => {
    if (!battle || battle.turn !== "opponent" || battle.winner) return;
    const timer = window.setTimeout(() => {
      setBattle((current) => {
        if (!current || current.turn !== "opponent" || current.winner) return current;
        const base = 10 + Math.floor(Math.random() * 10);
        const damage = current.shield ? clamp(base * 0.45, 3, 12) : base;
        const playerHp = clamp(current.playerHp - damage, 0, current.playerMaxHp);
        const winner = playerHp <= 0 ? "opponent" : null;
        return {
          ...current,
          playerHp,
          shield: false,
          turn: winner ? "complete" : "player",
          winner,
          round: current.round + 1,
          lastActor: "opponent",
          lastHit: "player",
          log: [
            `${current.opponent.name} countered for ${damage} damage${current.shield ? " through guard" : ""}.`,
            ...current.log,
          ].slice(0, 4),
        };
      });
    }, reduceMotion ? 250 : 850);
    return () => window.clearTimeout(timer);
  }, [battle, reduceMotion]);

  useEffect(() => {
    if (!battle || battle.turn !== "complete" || battle.winner !== "player") return;
    if (rewardedBattleRef.current === battle.id) return;
    rewardedBattleRef.current = battle.id;
    const reward = PERKS[Math.floor(Math.random() * PERKS.length)] ?? PERKS[0]!;
    updateInventory((current) => ({
      wins: current.wins + 1,
      perks: {
        ...current.perks,
        [reward.id]: current.perks[reward.id] + 1,
      },
    }));
    if (onBattleReward && !companionBusy) onBattleReward();
    appendLog(`Victory reward: ${reward.label} added to your partner kit.`);
  }, [appendLog, battle, companionBusy, onBattleReward, updateInventory]);

  const handleUsePerk = (perkId: PerkId) => {
    if (!battle || battle.turn !== "player" || inventory.perks[perkId] <= 0) return;
    updateInventory((current) => ({
      ...current,
      perks: { ...current.perks, [perkId]: Math.max(0, current.perks[perkId] - 1) },
    }));
    setBattle((current) => {
      if (!current) return current;
      if (perkId === "focus_lens") {
        return { ...current, focus: true, log: ["Focus Lens primed the next attack.", ...current.log].slice(0, 4) };
      }
      if (perkId === "guard_charm") {
        return { ...current, shield: true, log: ["Guard Charm raised a shield.", ...current.log].slice(0, 4) };
      }
      return {
        ...current,
        playerHp: clamp(current.playerHp + 22, 0, current.playerMaxHp),
        log: ["Berry Patch restored companion HP.", ...current.log].slice(0, 4),
      };
    });
  };

  if (!player) {
    return (
      <div className="rounded-lg border border-dashed border-white/12 bg-white/[0.03] p-5 text-center text-sm text-muted">
        Hatch a PGT Partner to unlock scan battles while extraction runs.
      </div>
    );
  }

  const opponent = battle?.opponent;
  const playerCanAct = active && battle?.turn === "player" && !battle.winner;

  return (
    <div className="overflow-hidden rounded-lg border border-white/[0.09] bg-[#071018]/82">
      <div className="flex flex-col gap-2 border-b border-white/[0.07] bg-white/[0.035] px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className={cn("text-[10px] font-semibold uppercase tracking-[0.2em]", playerUi.textSoft)}>
            Scan battle
          </p>
          <p className="mt-1 text-sm text-muted">
            {busy ? progress ?? "Extraction in progress" : "Battle between scan steps or while reviewing results."}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-3 py-2 font-mono text-xs text-primary">
          <Trophy className="h-3.5 w-3.5 text-energy-electric-2" />
          {inventory.wins} wins
        </div>
      </div>

      <div className="relative min-h-[17rem] overflow-hidden border-b border-white/[0.07] bg-[linear-gradient(180deg,rgba(15,23,42,0.18),rgba(2,6,23,0.5))] px-3 py-4">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_25%_72%,rgb(var(--energy-grass-glow)/0.14),transparent_38%),radial-gradient(ellipse_at_78%_24%,rgb(var(--energy-fire-glow)/0.12),transparent_36%)]" />
        <div className="relative grid min-h-[14.5rem] grid-cols-2 gap-3">
          <div className="flex flex-col justify-end">
            <div className="rounded-md border border-white/10 bg-black/35 p-2">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-xs font-semibold text-primary">{player.name}</p>
                <p className="font-mono text-[10px] text-faint">Lv {playerLevel}</p>
              </div>
              {battle ? <HpBar value={battle.playerHp} max={battle.playerMaxHp} tone="player" /> : null}
              <p className="mt-1 font-mono text-[10px] text-muted">
                {battle ? `${battle.playerHp}/${battle.playerMaxHp} HP` : "Ready"}
              </p>
            </div>
            <motion.div
              className="relative mt-2 grid h-28 place-items-center sm:h-32"
              animate={
                battle?.lastActor === "player" && !reduceMotion
                  ? { x: [0, 14, 0], scale: [1, 1.05, 1] }
                  : battle?.lastHit === "player" && !reduceMotion
                    ? { x: [0, -6, 6, 0] }
                    : undefined
              }
              transition={{ duration: 0.38 }}
            >
              <span className={cn("scanner-workflow-aura scanner-workflow-aura--powered", `scanner-workflow-aura--${playerEnergy}`)} />
              <PokemonSprite
                nationalId={player.id}
                slug={player.slug}
                name={player.name}
                types={player.types}
                display="battle"
                size="lg"
                className="relative z-[1] h-24 w-24 sm:h-32 sm:w-32"
              />
            </motion.div>
          </div>

          <div className="flex flex-col">
            {opponent ? (
              <div className="rounded-md border border-white/10 bg-black/35 p-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-xs font-semibold text-primary">{opponent.name}</p>
                  <p className="font-mono text-[10px] text-faint">Wild</p>
                </div>
                <HpBar value={battle.opponentHp} max={battle.opponentMaxHp} tone="opponent" />
                <p className="mt-1 font-mono text-[10px] text-muted">
                  {battle.opponentHp}/{battle.opponentMaxHp} HP
                </p>
              </div>
            ) : null}
            <motion.div
              className="relative mt-2 grid h-28 place-items-center sm:h-32"
              animate={
                battle?.lastActor === "opponent" && !reduceMotion
                  ? { x: [0, -14, 0], scale: [1, 1.05, 1] }
                  : battle?.lastHit === "opponent" && !reduceMotion
                    ? { x: [0, 6, -6, 0] }
                    : undefined
              }
              transition={{ duration: 0.38 }}
            >
              {opponent ? (
                <PokemonSprite
                  nationalId={opponent.id}
                  slug={opponent.slug}
                  name={opponent.name}
                  types={opponent.types}
                  display="battle"
                  size="lg"
                  className="relative z-[1] h-24 w-24 scale-x-[-1] sm:h-32 sm:w-32"
                />
              ) : null}
            </motion.div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 p-3 lg:grid-cols-[1fr_0.85fr]">
        <div className="rounded-lg border border-white/[0.08] bg-black/25 p-3">
          <div className="grid grid-cols-2 gap-2">
            {MOVES.map((move) => {
              const Icon = move.icon;
              return (
                <button
                  key={move.id}
                  type="button"
                  disabled={!playerCanAct}
                  onClick={() => runPlayerMove(move)}
                  className="rounded-md border border-white/10 bg-white/[0.045] p-2 text-left transition hover:border-energy-electric-1/35 hover:bg-energy-electric-1/10 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <span className="flex items-center gap-2 text-xs font-semibold text-primary">
                    <Icon className="h-3.5 w-3.5 text-energy-electric-2" />
                    {move.label}
                  </span>
                  <span className="mt-1 block text-[10px] text-muted">{move.detail}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {PERKS.map((perk) => {
              const Icon = perk.icon;
              const count = inventory.perks[perk.id];
              return (
                <button
                  key={perk.id}
                  type="button"
                  disabled={!playerCanAct || count <= 0}
                  onClick={() => handleUsePerk(perk.id)}
                  className="rounded-md border border-white/10 bg-white/[0.035] px-2 py-2 text-left transition hover:border-energy-grass-1/30 hover:bg-energy-grass-1/10 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <span className="flex items-center justify-between gap-2 text-[10px] font-semibold text-slate-300">
                    <Icon className="h-3.5 w-3.5 text-energy-grass-2" />
                    x{count}
                  </span>
                  <span className="mt-1 block truncate text-[10px] text-muted">{perk.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-white/[0.08] bg-black/25 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-faint">
              Battle feed
            </p>
            <span className={cn("rounded-full border px-2 py-0.5 font-mono text-[10px]", playerUi.ring, playerUi.textSoft)}>
              {battle?.turn === "player" ? "Your turn" : battle?.turn === "opponent" ? "AI turn" : "Complete"}
            </span>
          </div>
          <div className="mt-3 min-h-[6.5rem] space-y-2 font-mono text-[11px] leading-5 text-slate-300">
            {(battle?.log ?? ["Battle initializes when scan progress starts."]).map((line, index) => (
              <p key={`${line}-${index}`} className={index === 0 ? "text-primary" : "text-muted"}>
                {line}
              </p>
            ))}
          </div>
          <button
            type="button"
            onClick={startBattle}
            disabled={!active}
            className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-energy-electric-1/25 bg-energy-electric-1/10 px-3 text-xs font-semibold text-energy-electric-3 transition hover:bg-energy-electric-1/15 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Sparkles className="h-3.5 w-3.5" />
            New wild encounter
          </button>
        </div>
      </div>
    </div>
  );
}
