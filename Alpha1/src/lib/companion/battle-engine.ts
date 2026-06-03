import type { CompanionPokemon } from "@/lib/companion/pokemon-roster";
import {
  COMPANION_ROSTER,
  pickRandomCompanionPokemonExcluding,
} from "@/lib/companion/pokemon-roster";
import type { CompanionState } from "@/lib/companion/schemas";
import { ACTION_META } from "@/lib/companion/game-engine";

export const TEAM_ROCKET_CHANCE = 0.11;

export type BattleEncounterKind = "wild" | "team_rocket";

export type BattleMove = {
  id: string;
  name: string;
  type: string;
  power: number;
  pp: number;
  maxPp: number;
};

export type BattleFighter = {
  pokemonId: number;
  name: string;
  slug: string;
  types: string[];
  level: number;
  hp: number;
  maxHp: number;
  moves: BattleMove[];
};

export type BattlePhase = "intro" | "player" | "resolving" | "ended";

export type BattleState = {
  encounter: BattleEncounterKind;
  enemyTrainer: string;
  enemySubLabel: string;
  introLines: string[];
  player: BattleFighter;
  enemy: BattleFighter;
  phase: BattlePhase;
  turnMessage: string;
  log: string[];
  winner: "player" | "enemy" | null;
};

const TYPE_MOVES: Record<string, Array<{ name: string; power: number }>> = {
  normal: [
    { name: "Tackle", power: 40 },
    { name: "Scratch", power: 40 },
    { name: "Body Slam", power: 85 },
  ],
  fire: [
    { name: "Ember", power: 40 },
    { name: "Flamethrower", power: 90 },
    { name: "Fire Spin", power: 35 },
  ],
  water: [
    { name: "Water Gun", power: 40 },
    { name: "Bubble Beam", power: 65 },
    { name: "Surf", power: 90 },
  ],
  grass: [
    { name: "Vine Whip", power: 45 },
    { name: "Razor Leaf", power: 55 },
    { name: "Solar Beam", power: 120 },
  ],
  electric: [
    { name: "Thunder Shock", power: 40 },
    { name: "Thunderbolt", power: 90 },
    { name: "Spark", power: 65 },
  ],
  ice: [
    { name: "Powder Snow", power: 40 },
    { name: "Ice Beam", power: 90 },
    { name: "Blizzard", power: 110 },
  ],
  fighting: [
    { name: "Karate Chop", power: 50 },
    { name: "Brick Break", power: 75 },
    { name: "Close Combat", power: 120 },
  ],
  poison: [
    { name: "Poison Sting", power: 35 },
    { name: "Sludge Bomb", power: 90 },
  ],
  ground: [
    { name: "Mud Slap", power: 35 },
    { name: "Earthquake", power: 100 },
  ],
  flying: [
    { name: "Gust", power: 40 },
    { name: "Wing Attack", power: 60 },
    { name: "Aerial Ace", power: 60 },
  ],
  psychic: [
    { name: "Confusion", power: 50 },
    { name: "Psychic", power: 90 },
  ],
  bug: [
    { name: "Bug Bite", power: 60 },
    { name: "X-Scissor", power: 80 },
  ],
  rock: [
    { name: "Rock Throw", power: 50 },
    { name: "Rock Slide", power: 75 },
  ],
  ghost: [
    { name: "Lick", power: 30 },
    { name: "Shadow Ball", power: 80 },
  ],
  dragon: [
    { name: "Dragon Breath", power: 60 },
    { name: "Dragon Pulse", power: 85 },
  ],
  dark: [
    { name: "Bite", power: 60 },
    { name: "Crunch", power: 80 },
  ],
  steel: [
    { name: "Metal Claw", power: 50 },
    { name: "Iron Tail", power: 100 },
  ],
  fairy: [
    { name: "Fairy Wind", power: 40 },
    { name: "Moonblast", power: 95 },
  ],
};

/** Gen-style type chart (attacking type → defending type multiplier). */
const TYPE_EFFECTIVENESS: Record<string, Partial<Record<string, number>>> = {
  normal: { rock: 0.5, ghost: 0 },
  fire: { grass: 2, ice: 2, bug: 2, steel: 2, fire: 0.5, water: 0.5, rock: 0.5, dragon: 0.5 },
  water: { fire: 2, ground: 2, rock: 2, water: 0.5, grass: 0.5, dragon: 0.5 },
  grass: { water: 2, ground: 2, rock: 2, fire: 0.5, grass: 0.5, poison: 0.5, flying: 0.5, bug: 0.5, dragon: 0.5, steel: 0.5 },
  electric: { water: 2, flying: 2, electric: 0.5, grass: 0.5, dragon: 0.5, ground: 0 },
  ice: { grass: 2, ground: 2, flying: 2, dragon: 2, fire: 0.5, water: 0.5, ice: 0.5, steel: 0.5 },
  fighting: { normal: 2, ice: 2, rock: 2, dark: 2, steel: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, fairy: 0.5, ghost: 0 },
  poison: { grass: 2, fairy: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0 },
  ground: { fire: 2, electric: 2, poison: 2, rock: 2, steel: 2, grass: 0.5, bug: 0.5, flying: 0 },
  flying: { grass: 2, fighting: 2, bug: 2, electric: 0.5, rock: 0.5, steel: 0.5 },
  psychic: { fighting: 2, poison: 2, psychic: 0.5, steel: 0.5, dark: 0 },
  bug: { grass: 2, psychic: 2, dark: 2, fire: 0.5, fighting: 0.5, poison: 0.5, flying: 0.5, ghost: 0.5, steel: 0.5, fairy: 0.5 },
  rock: { fire: 2, ice: 2, flying: 2, bug: 2, fighting: 0.5, ground: 0.5, steel: 0.5 },
  ghost: { psychic: 2, ghost: 2, dark: 0.5, normal: 0 },
  dragon: { dragon: 2, steel: 0.5, fairy: 0.5 },
  dark: { psychic: 2, ghost: 2, fighting: 0.5, dark: 0.5, fairy: 0.5 },
  steel: { ice: 2, rock: 2, fairy: 2, fire: 0.5, water: 0.5, electric: 0.5, steel: 0.5 },
  fairy: { fighting: 2, dragon: 2, dark: 2, fire: 0.5, poison: 0.5, steel: 0.5 },
};

const TEAM_ROCKET_MEOWTH: CompanionPokemon = {
  id: 52,
  name: "Meowth",
  slug: "meowth",
  tier: "starter",
  era: "Kanto",
  types: ["normal"],
};

export function getBattleBlockReason(state: CompanionState | null): string | null {
  if (!state?.hatched) return "Hatch a partner first";
  const meta = ACTION_META.battle;
  const readyAt = state.actionCooldowns.battle;
  if (readyAt && new Date(readyAt).getTime() > Date.now()) {
    return `${meta.label} is on cooldown`;
  }
  if (state.energy + meta.energy < 8) return "Too tired — rest first";
  if (state.hunger + meta.hunger < 8) return "Too hungry — feed first";
  return null;
}

function maxHpForLevel(level: number, tier?: string | null): number {
  const base = tier === "mythical" || tier === "legendary" ? 38 : tier === "eevee" ? 32 : 28;
  return Math.floor(base + level * 4.5);
}

function buildMoves(types: string[]): BattleMove[] {
  const seen = new Set<string>();
  const moves: BattleMove[] = [];

  for (const type of [...types, "normal"]) {
    const pool = TYPE_MOVES[type] ?? TYPE_MOVES.normal!;
    for (const m of pool) {
      const key = `${m.name}-${type}`;
      if (seen.has(key)) continue;
      seen.add(key);
      moves.push({
        id: key,
        name: m.name,
        type,
        power: m.power,
        pp: 20,
        maxPp: 20,
      });
      if (moves.length >= 4) break;
    }
    if (moves.length >= 4) break;
  }

  return moves.slice(0, 4);
}

function fighterFromPokemon(pokemon: CompanionPokemon, level: number): BattleFighter {
  const maxHp = maxHpForLevel(level, pokemon.tier);
  return {
    pokemonId: pokemon.id,
    name: pokemon.name,
    slug: pokemon.slug,
    types: pokemon.types,
    level,
    hp: maxHp,
    maxHp,
    moves: buildMoves(pokemon.types),
  };
}

function rollTeamRocket(): boolean {
  return Math.random() < TEAM_ROCKET_CHANCE;
}

function pickWildOpponent(excludeId: number): CompanionPokemon {
  return pickRandomCompanionPokemonExcluding(excludeId);
}

export function createBattle(player: CompanionPokemon, playerLevel: number): BattleState {
  const teamRocket = rollTeamRocket();
  const enemyMon = teamRocket ? TEAM_ROCKET_MEOWTH : pickWildOpponent(player.id);
  const enemyLevel = Math.max(
    1,
    playerLevel + (teamRocket ? 1 : Math.floor(Math.random() * 3) - 1),
  );

  const playerFighter = fighterFromPokemon(player, playerLevel);
  const enemyFighter = fighterFromPokemon(enemyMon, enemyLevel);

  const introLines = teamRocket
    ? ["Prepare for trouble!", "And make it double!", "Team Rocket blasts off at you!"]
    : [`Wild ${enemyMon.name} appeared!`];

  return {
    encounter: teamRocket ? "team_rocket" : "wild",
    enemyTrainer: teamRocket ? "Team Rocket" : "Wild encounter",
    enemySubLabel: teamRocket ? "Jessie · James · Meowth" : enemyMon.era,
    introLines,
    player: playerFighter,
    enemy: enemyFighter,
    phase: "intro",
    turnMessage: introLines[0] ?? "Battle start!",
    log: [],
    winner: null,
  };
}

export function effectivenessLabel(multiplier: number): string {
  if (multiplier >= 2) return "It's super effective!";
  if (multiplier > 0 && multiplier < 1) return "It's not very effective…";
  if (multiplier === 0) return "It doesn't affect the foe…";
  return "";
}

export function typeMultiplier(attackType: string, defenderTypes: string[]): number {
  let mult = 1;
  for (const defType of defenderTypes) {
    const row = TYPE_EFFECTIVENESS[attackType];
    if (row && row[defType] != null) mult *= row[defType]!;
  }
  return mult;
}

export function calcDamage(
  attackerLevel: number,
  move: BattleMove,
  defenderTypes: string[],
): { damage: number; effectiveness: number } {
  const effectiveness = typeMultiplier(move.type, defenderTypes);
  if (effectiveness === 0) return { damage: 0, effectiveness: 0 };

  const random = 0.85 + Math.random() * 0.15;
  const base = Math.floor(((attackerLevel * 2) / 5 + 2) * (move.power / 10));
  const damage = Math.max(1, Math.floor(base * effectiveness * random));
  return { damage, effectiveness };
}

function cloneFighter(f: BattleFighter): BattleFighter {
  return {
    ...f,
    moves: f.moves.map((m) => ({ ...m })),
  };
}

function pickEnemyMove(fighter: BattleFighter): BattleMove | null {
  const usable = fighter.moves.filter((m) => m.pp > 0);
  if (!usable.length) return null;
  return usable[Math.floor(Math.random() * usable.length)]!;
}

export function applyMove(
  state: BattleState,
  attackerSide: "player" | "enemy",
  moveIndex: number,
): BattleState {
  const player = cloneFighter(state.player);
  const enemy = cloneFighter(state.enemy);
  const attacker = attackerSide === "player" ? player : enemy;
  const defender = attackerSide === "player" ? enemy : player;
  const move = attacker.moves[moveIndex];
  if (!move || move.pp <= 0) return state;

  move.pp -= 1;
  const { damage, effectiveness } = calcDamage(attacker.level, move, defender.types);
  defender.hp = Math.max(0, defender.hp - damage);

  const effText = effectivenessLabel(effectiveness);
  const lines = [
    `${attacker.name} used ${move.name}!`,
    ...(damage > 0 ? [`${defender.name} took ${damage} damage!`] : []),
    ...(effText ? [effText] : []),
  ];

  let winner: "player" | "enemy" | null = null;
  if (defender.hp <= 0) {
    lines.push(`${defender.name} fainted!`);
    winner = attackerSide;
  }

  return {
    ...state,
    player,
    enemy,
    phase: winner ? "ended" : state.phase,
    winner,
    turnMessage: lines[lines.length - 1] ?? move.name,
    log: [...state.log, ...lines].slice(-8),
  };
}

export function runEnemyTurn(state: BattleState): BattleState {
  if (state.phase === "ended" || state.winner) return state;
  const move = pickEnemyMove(state.enemy);
  if (!move) {
    return {
      ...state,
      turnMessage: `${state.enemy.name} has no moves left!`,
      phase: "player",
    };
  }
  const idx = state.enemy.moves.findIndex((m) => m.id === move.id);
  const next = applyMove({ ...state, phase: "resolving" }, "enemy", idx);
  return {
    ...next,
    phase: next.winner ? "ended" : "player",
  };
}

export function advanceIntro(state: BattleState): BattleState {
  if (state.phase !== "intro") return state;
  return {
    ...state,
    phase: "player",
    turnMessage: `Go! ${state.player.name}!`,
    log: [...state.log, ...state.introLines],
  };
}

export function typeBadgeColor(type: string): string {
  const map: Record<string, string> = {
    fire: "bg-orange-500/25 text-orange-200 border-orange-400/35",
    water: "bg-sky-500/25 text-sky-200 border-sky-400/35",
    grass: "bg-emerald-500/25 text-emerald-200 border-emerald-400/35",
    electric: "bg-yellow-500/25 text-yellow-100 border-yellow-400/35",
    normal: "bg-slate-500/25 text-slate-200 border-slate-400/35",
    psychic: "bg-fuchsia-500/25 text-fuchsia-200 border-fuchsia-400/35",
    dark: "bg-violet-500/25 text-violet-200 border-violet-400/35",
    fairy: "bg-pink-500/25 text-pink-200 border-pink-400/35",
    dragon: "bg-indigo-500/25 text-indigo-200 border-indigo-400/35",
    ice: "bg-cyan-500/25 text-cyan-100 border-cyan-400/35",
    fighting: "bg-red-500/25 text-red-200 border-red-400/35",
    flying: "bg-indigo-400/25 text-indigo-100 border-indigo-300/35",
    poison: "bg-purple-500/25 text-purple-200 border-purple-400/35",
    ground: "bg-amber-700/25 text-amber-200 border-amber-600/35",
    rock: "bg-stone-500/25 text-stone-200 border-stone-400/35",
    bug: "bg-lime-500/25 text-lime-200 border-lime-400/35",
    ghost: "bg-violet-600/25 text-violet-100 border-violet-500/35",
    steel: "bg-zinc-500/25 text-zinc-200 border-zinc-400/35",
  };
  return map[type] ?? map.normal!;
}

/** Opponent pool size for tests / UI hints. */
export const BATTLE_OPPONENT_POOL_SIZE = COMPANION_ROSTER.length;
