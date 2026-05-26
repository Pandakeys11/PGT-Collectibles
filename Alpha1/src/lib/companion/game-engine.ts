import type { CompanionActionId, CompanionState } from "@/lib/companion/schemas";
import {
  getCompanionPokemon,
  pickRandomCompanionPokemon,
  pickRandomCompanionPokemonExcluding,
  type CompanionPokemon,
} from "@/lib/companion/pokemon-roster";
import type { CompanionQuestEvent } from "@/lib/companion/schemas";

export const MAX_STARTER_REROLLS = 3;

export type CompanionPersisted = {
  pokemonId: number;
  pokemonName: string;
  pokemonSlug: string;
  pokemonTier: string;
  pokemonEra: string;
  hatchedAt: string;
  level: number;
  xp: number;
  hunger: number;
  energy: number;
  mood: number;
  lastTickAt: string;
  actionCooldowns: Record<string, string | null>;
  taskProgress: Record<string, number>;
  taskClaimed: Record<string, string | null>;
  lifetime: {
    feeds: number;
    plays: number;
    trains: number;
    battles: number;
    rests: number;
    tasksClaimed: number;
  };
  usageScansThisWeek: number;
  usageWeekKey: string;
  starterRerollsUsed: number;
};

export const ACTION_META: Record<
  CompanionActionId,
  {
    label: string;
    cooldownMs: number;
    hunger: number;
    energy: number;
    mood: number;
    xp: number;
    taskKey?: string;
  }
> = {
  feed: { label: "Feed", cooldownMs: 2 * 60 * 60 * 1000, hunger: 28, energy: -4, mood: 6, xp: 8, taskKey: "daily_feed" },
  play: { label: "Play", cooldownMs: 60 * 60 * 1000, hunger: -6, energy: -12, mood: 22, xp: 10 },
  train: {
    label: "Train",
    cooldownMs: 4 * 60 * 60 * 1000,
    hunger: -10,
    energy: -18,
    mood: 4,
    xp: 18,
    taskKey: "weekly_train",
  },
  battle: {
    label: "Battle",
    cooldownMs: 6 * 60 * 60 * 1000,
    hunger: -14,
    energy: -26,
    mood: 12,
    xp: 28,
    taskKey: "weekly_battle",
  },
  rest: { label: "Rest", cooldownMs: 3 * 60 * 60 * 1000, hunger: -5, energy: 34, mood: 8, xp: 6 },
};

export type TaskDef = {
  id: string;
  label: string;
  window: "daily" | "weekly" | "usage";
  goal: number;
  rewardXp: number;
};

export const TASK_DEFINITIONS: TaskDef[] = [
  { id: "daily_login", label: "Check in on your partner", window: "daily", goal: 1, rewardXp: 12 },
  { id: "daily_scan_session", label: "Run a Liquid Scan session", window: "daily", goal: 1, rewardXp: 18 },
  { id: "daily_market_intel", label: "Review market intelligence", window: "daily", goal: 1, rewardXp: 16 },
  { id: "daily_catalog_lock", label: "Confirm a catalog match", window: "daily", goal: 1, rewardXp: 20 },
  { id: "daily_scan_three", label: "Scan 3 cards today", window: "daily", goal: 3, rewardXp: 28 },
  { id: "daily_feed", label: "Feed once", window: "daily", goal: 1, rewardXp: 15 },
  { id: "daily_care", label: "Any care action", window: "daily", goal: 2, rewardXp: 20 },
  { id: "weekly_train", label: "Train 3 times", window: "weekly", goal: 3, rewardXp: 55 },
  { id: "weekly_battle", label: "Battle twice", window: "weekly", goal: 2, rewardXp: 65 },
  { id: "weekly_scan_fifteen", label: "Scan 15 cards this week", window: "usage", goal: 15, rewardXp: 95 },
  { id: "usage_scans", label: "Complete 5 card scans", window: "usage", goal: 5, rewardXp: 80 },
];

export const QUEST_EVENT_TO_TASK: Record<CompanionQuestEvent, string> = {
  scan_session: "daily_scan_session",
  market_intelligence: "daily_market_intel",
  catalog_confirm: "daily_catalog_lock",
  cards_scanned: "daily_scan_three",
};

const HUNGER_DECAY_PER_HOUR = 3.5;
const ENERGY_DECAY_PER_HOUR = 2;
const MOOD_DECAY_PER_HOUR = 1.5;

export function dayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function weekKey(date = new Date()): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - day + 1);
  return d.toISOString().slice(0, 10);
}

function clampStat(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function xpForLevel(level: number): number {
  return 40 + level * 22;
}

export function emptyCompanionPersisted(): null {
  return null;
}

function taskProgressKey(
  taskId: string,
  window: TaskDef["window"],
  now: Date,
  usageWeekKey: string,
): string {
  const windowKey =
    window === "daily" ? dayKey(now) : window === "weekly" ? weekKey(now) : usageWeekKey;
  return `${taskId}_${windowKey}`;
}

export function createHatchedCompanion(pokemon: CompanionPokemon): CompanionPersisted {
  const nowDate = new Date();
  const now = nowDate.toISOString();
  const wKey = weekKey(nowDate);
  const loginKey = taskProgressKey("daily_login", "daily", nowDate, wKey);
  return {
    pokemonId: pokemon.id,
    pokemonName: pokemon.name,
    pokemonSlug: pokemon.slug,
    pokemonTier: pokemon.tier,
    pokemonEra: pokemon.era,
    hatchedAt: now,
    level: 1,
    xp: 0,
    hunger: 82,
    energy: 88,
    mood: 78,
    lastTickAt: now,
    actionCooldowns: {},
    taskProgress: { [loginKey]: 1 },
    taskClaimed: {},
    lifetime: { feeds: 0, plays: 0, trains: 0, battles: 0, rests: 0, tasksClaimed: 0 },
    usageScansThisWeek: 0,
    usageWeekKey: wKey,
    starterRerollsUsed: 0,
  };
}

function bumpTaskProgress(
  row: CompanionPersisted,
  taskId: string,
  amount: number,
  now = new Date(),
): CompanionPersisted {
  const task = TASK_DEFINITIONS.find((t) => t.id === taskId);
  if (!task || amount <= 0) return row;
  const progressKey = taskProgressKey(task.id, task.window, now, row.usageWeekKey);
  const current =
    task.id === "usage_scans"
      ? row.usageScansThisWeek
      : (row.taskProgress[progressKey] ?? 0);
  return {
    ...row,
    taskProgress: {
      ...row.taskProgress,
      [progressKey]: Math.min(task.goal, current + amount),
    },
  };
}

export function recordCompanionQuestEvent(
  row: CompanionPersisted,
  event: CompanionQuestEvent,
  amount = 1,
  now = new Date(),
): CompanionPersisted {
  const taskId = QUEST_EVENT_TO_TASK[event];
  let next = bumpTaskProgress(row, taskId, amount, now);
  if (event === "cards_scanned") {
    next = recordScanUsage(next, amount, now);
  }
  return next;
}

export function rerollCompanionStarter(
  row: CompanionPersisted,
  now = new Date(),
): { row: CompanionPersisted; pokemon: CompanionPokemon; error?: string } {
  if (row.starterRerollsUsed >= MAX_STARTER_REROLLS) {
    const current = getCompanionPokemon(row.pokemonId);
    return {
      row,
      error: "No starter rerolls remaining",
      pokemon: current ?? pickRandomCompanionPokemon(),
    };
  }

  const pokemon = pickRandomCompanionPokemonExcluding(row.pokemonId);
  const next: CompanionPersisted = {
    ...row,
    pokemonId: pokemon.id,
    pokemonName: pokemon.name,
    pokemonSlug: pokemon.slug,
    pokemonTier: pokemon.tier,
    pokemonEra: pokemon.era,
    starterRerollsUsed: row.starterRerollsUsed + 1,
    mood: clampStat(row.mood + 6),
    lastTickAt: now.toISOString(),
  };

  return { row: next, pokemon };
}

export function applyTimeDecay(row: CompanionPersisted, now = new Date()): CompanionPersisted {
  const last = new Date(row.lastTickAt).getTime();
  const elapsedHours = Math.max(0, (now.getTime() - last) / (60 * 60 * 1000));
  if (elapsedHours < 0.05) return row;

  return {
    ...row,
    hunger: clampStat(row.hunger - elapsedHours * HUNGER_DECAY_PER_HOUR),
    energy: clampStat(row.energy - elapsedHours * ENERGY_DECAY_PER_HOUR),
    mood: clampStat(row.mood - elapsedHours * MOOD_DECAY_PER_HOUR),
    lastTickAt: now.toISOString(),
  };
}

function resetTasksIfNeeded(row: CompanionPersisted, now = new Date()): CompanionPersisted {
  const dKey = dayKey(now);
  const wKey = weekKey(now);
  const taskProgress = { ...row.taskProgress };
  const taskClaimed = { ...row.taskClaimed };

  if (typeof taskProgress.daily_login === "number") {
    taskProgress[taskProgressKey("daily_login", "daily", now, row.usageWeekKey)] = taskProgress.daily_login;
    delete taskProgress.daily_login;
  }

  for (const task of TASK_DEFINITIONS) {
    const claimKey = `${task.id}_claimed`;
    const windowKey = task.window === "daily" ? dKey : task.window === "weekly" ? wKey : row.usageWeekKey;
    const progressKey = taskProgressKey(task.id, task.window, now, row.usageWeekKey);

    if (taskClaimed[claimKey] && taskClaimed[claimKey] !== windowKey) {
      delete taskClaimed[claimKey];
    }
    if (task.window === "usage" && row.usageWeekKey !== wKey) {
      row = { ...row, usageWeekKey: wKey, usageScansThisWeek: 0 };
    }
    if (!taskProgress[progressKey] && task.id === "daily_login") {
      taskProgress[progressKey] = 1;
    }
  }

  if (row.usageWeekKey !== wKey) {
    return {
      ...row,
      usageWeekKey: wKey,
      usageScansThisWeek: 0,
      taskProgress,
      taskClaimed,
    };
  }

  return { ...row, taskProgress, taskClaimed };
}

function moodLabel(mood: number): string {
  if (mood >= 85) return "Ecstatic";
  if (mood >= 65) return "Happy";
  if (mood >= 45) return "Calm";
  if (mood >= 25) return "Hungry";
  return "Needs care";
}

function cooldownRemaining(iso: string | null | undefined, now: Date): number {
  if (!iso) return 0;
  return Math.max(0, new Date(iso).getTime() - now.getTime());
}

export function performAction(
  row: CompanionPersisted,
  action: CompanionActionId,
  now = new Date(),
): { row: CompanionPersisted; error?: string } {
  const meta = ACTION_META[action];
  const readyAt = row.actionCooldowns[action];
  if (cooldownRemaining(readyAt, now) > 0) {
    return { row, error: `${meta.label} is on cooldown` };
  }

  if (action !== "feed" && action !== "rest" && meta.energy < 0 && row.energy + meta.energy < 8) {
    return { row, error: "Too tired — rest first" };
  }
  if (action !== "feed" && action !== "rest" && meta.hunger < 0 && row.hunger + meta.hunger < 8) {
    return { row, error: "Too hungry — feed first" };
  }

  const next: CompanionPersisted = {
    ...row,
    hunger: clampStat(row.hunger + meta.hunger),
    energy: clampStat(row.energy + meta.energy),
    mood: clampStat(row.mood + meta.mood),
    xp: row.xp + meta.xp,
    lastTickAt: now.toISOString(),
    actionCooldowns: {
      ...row.actionCooldowns,
      [action]: new Date(now.getTime() + meta.cooldownMs).toISOString(),
    },
    lifetime: { ...row.lifetime },
    taskProgress: { ...row.taskProgress },
  };

  if (action === "feed") next.lifetime.feeds += 1;
  if (action === "play") next.lifetime.plays += 1;
  if (action === "train") next.lifetime.trains += 1;
  if (action === "battle") next.lifetime.battles += 1;
  if (action === "rest") next.lifetime.rests += 1;

  const careKey = taskProgressKey("daily_care", "daily", now, next.usageWeekKey);
  next.taskProgress[careKey] = (next.taskProgress[careKey] ?? 0) + 1;
  if (meta.taskKey) {
    const taskDef = TASK_DEFINITIONS.find((t) => t.id === meta.taskKey);
    const window = taskDef?.window ?? "daily";
    const pKey = taskProgressKey(meta.taskKey, window, now, next.usageWeekKey);
    next.taskProgress[pKey] = (next.taskProgress[pKey] ?? 0) + 1;
  }

  while (next.xp >= xpForLevel(next.level)) {
    next.xp -= xpForLevel(next.level);
    next.level += 1;
    next.mood = clampStat(next.mood + 8);
  }

  return { row: next };
}

export function recordScanUsage(row: CompanionPersisted, count = 1, now = new Date()): CompanionPersisted {
  const wKey = weekKey(now);
  let next = row.usageWeekKey === wKey ? row : { ...row, usageWeekKey: wKey, usageScansThisWeek: 0 };
  const usageKey = taskProgressKey("usage_scans", "usage", now, wKey);
  next = {
    ...next,
    usageScansThisWeek: next.usageScansThisWeek + count,
    taskProgress: {
      ...next.taskProgress,
      [usageKey]: (next.usageWeekKey === wKey ? next.usageScansThisWeek : 0) + count,
    },
  };
  return next;
}

export function claimTask(
  row: CompanionPersisted,
  taskId: string,
  now = new Date(),
): { row: CompanionPersisted; error?: string; rewardXp?: number } {
  const task = TASK_DEFINITIONS.find((t) => t.id === taskId);
  if (!task) return { row, error: "Unknown task" };

  const dKey = dayKey(now);
  const wKey = weekKey(now);
  const windowKey = task.window === "daily" ? dKey : task.window === "weekly" ? wKey : row.usageWeekKey;
  const progressKey = taskProgressKey(task.id, task.window, now, row.usageWeekKey);
  const claimKey = `${task.id}_claimed`;
  const progress =
    task.id === "usage_scans" || task.id === "weekly_scan_fifteen"
      ? row.usageScansThisWeek
      : (row.taskProgress[progressKey] ?? 0);

  if (progress < task.goal) return { row, error: "Task not complete yet" };
  if (row.taskClaimed[claimKey] === windowKey) return { row, error: "Already claimed" };

  const next: CompanionPersisted = {
    ...row,
    xp: row.xp + task.rewardXp,
    taskClaimed: { ...row.taskClaimed, [claimKey]: windowKey },
    lifetime: { ...row.lifetime, tasksClaimed: row.lifetime.tasksClaimed + 1 },
  };

  while (next.xp >= xpForLevel(next.level)) {
    next.xp -= xpForLevel(next.level);
    next.level += 1;
  }

  return { row: next, rewardXp: task.rewardXp };
}

export function toCompanionState(
  row: CompanionPersisted | null,
  storage: "database" | "local",
  scanCountThisWeek = 0,
): CompanionState {
  const now = new Date();
  if (!row) {
    return {
      hatched: false,
      pokemonId: null,
      pokemonName: null,
      pokemonSlug: null,
      pokemonTier: null,
      pokemonEra: null,
      hatchedAt: null,
      level: 1,
      xp: 0,
      xpToNext: xpForLevel(1),
      hunger: 0,
      energy: 0,
      mood: 0,
      moodLabel: "—",
      actionCooldowns: {},
      tasks: [],
      lifetime: { feeds: 0, plays: 0, trains: 0, battles: 0, rests: 0, tasksClaimed: 0 },
      lastTickAt: now.toISOString(),
      storage,
      starterRerollsUsed: 0,
      starterRerollsRemaining: MAX_STARTER_REROLLS,
    };
  }

  let ticked = applyTimeDecay(row, now);
  ticked = resetTasksIfNeeded(ticked, now);
  if (scanCountThisWeek > ticked.usageScansThisWeek) {
    ticked = recordScanUsage(ticked, scanCountThisWeek - ticked.usageScansThisWeek, now);
  }

  const dKey = dayKey(now);
  const wKey = weekKey(now);
  const tasks = TASK_DEFINITIONS.map((task) => {
    const windowKey = task.window === "daily" ? dKey : task.window === "weekly" ? wKey : ticked.usageWeekKey;
    const progressKey = taskProgressKey(task.id, task.window, now, ticked.usageWeekKey);
    const claimKey = `${task.id}_claimed`;
    const progress =
      task.id === "usage_scans" || task.id === "weekly_scan_fifteen"
        ? ticked.usageScansThisWeek
        : (ticked.taskProgress[progressKey] ?? 0);
    const complete = progress >= task.goal;
    const claimed = ticked.taskClaimed[claimKey] === windowKey;
    const resetsAt =
      task.window === "daily"
        ? `${dKey}T23:59:59.999Z`
        : task.window === "weekly"
          ? new Date(new Date(wKey).getTime() + 7 * 86400000).toISOString()
          : new Date(new Date(ticked.usageWeekKey).getTime() + 7 * 86400000).toISOString();

    return {
      id: task.id,
      label: task.label,
      window: task.window,
      progress: Math.min(progress, task.goal),
      goal: task.goal,
      rewardXp: task.rewardXp,
      claimed,
      complete,
      resetsAt,
    };
  });

  const actionCooldowns: Record<string, string | null> = {};
  for (const action of Object.keys(ACTION_META) as CompanionActionId[]) {
    const iso = ticked.actionCooldowns[action] ?? null;
    actionCooldowns[action] = cooldownRemaining(iso, now) > 0 ? iso : null;
  }

  return {
    hatched: true,
    pokemonId: ticked.pokemonId,
    pokemonName: ticked.pokemonName,
    pokemonSlug: ticked.pokemonSlug,
    pokemonTier: ticked.pokemonTier,
    pokemonEra: ticked.pokemonEra,
    hatchedAt: ticked.hatchedAt,
    level: ticked.level,
    xp: ticked.xp,
    xpToNext: xpForLevel(ticked.level),
    hunger: ticked.hunger,
    energy: ticked.energy,
    mood: ticked.mood,
    moodLabel: moodLabel(ticked.mood),
    actionCooldowns,
    tasks,
    lifetime: ticked.lifetime,
    lastTickAt: ticked.lastTickAt,
    storage,
    starterRerollsUsed: ticked.starterRerollsUsed,
    starterRerollsRemaining: Math.max(0, MAX_STARTER_REROLLS - ticked.starterRerollsUsed),
  };
}

export function hatchCompanion(): CompanionPersisted {
  return createHatchedCompanion(pickRandomCompanionPokemon());
}

export function parsePersistedRow(raw: unknown): CompanionPersisted | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const pokemonId = Number(r.pokemonId ?? r.pokemon_id);
  if (!Number.isFinite(pokemonId)) return null;
  const pokemon = getCompanionPokemon(pokemonId);
  if (!pokemon) return null;

  return {
    pokemonId: pokemon.id,
    pokemonName: String(r.pokemonName ?? r.pokemon_name ?? pokemon.name),
    pokemonSlug: String(r.pokemonSlug ?? r.pokemon_slug ?? pokemon.slug),
    pokemonTier: String(r.pokemonTier ?? r.pokemon_tier ?? pokemon.tier),
    pokemonEra: String(r.pokemonEra ?? r.pokemon_era ?? pokemon.era),
    hatchedAt: String(r.hatchedAt ?? r.hatched_at ?? new Date().toISOString()),
    level: Number(r.level ?? 1),
    xp: Number(r.xp ?? 0),
    hunger: Number(r.hunger ?? 80),
    energy: Number(r.energy ?? 80),
    mood: Number(r.mood ?? 75),
    lastTickAt: String(r.lastTickAt ?? r.last_tick_at ?? new Date().toISOString()),
    actionCooldowns: (r.actionCooldowns ?? r.action_cooldowns ?? {}) as Record<string, string | null>,
    taskProgress: (r.taskProgress ?? r.task_progress ?? {}) as Record<string, number>,
    taskClaimed: (r.taskClaimed ?? r.task_claimed ?? {}) as Record<string, string | null>,
    lifetime: {
      feeds: Number((r.lifetime as Record<string, number>)?.feeds ?? 0),
      plays: Number((r.lifetime as Record<string, number>)?.plays ?? 0),
      trains: Number((r.lifetime as Record<string, number>)?.trains ?? 0),
      battles: Number((r.lifetime as Record<string, number>)?.battles ?? 0),
      rests: Number((r.lifetime as Record<string, number>)?.rests ?? 0),
      tasksClaimed: Number((r.lifetime as Record<string, number>)?.tasksClaimed ?? 0),
    },
    usageScansThisWeek: Number(r.usageScansThisWeek ?? r.usage_scans_this_week ?? 0),
    usageWeekKey: String(r.usageWeekKey ?? r.usage_week_key ?? weekKey()),
    starterRerollsUsed: Math.min(
      MAX_STARTER_REROLLS,
      Math.max(0, Number(r.starterRerollsUsed ?? r.starter_rerolls_used ?? 0)),
    ),
  };
}
