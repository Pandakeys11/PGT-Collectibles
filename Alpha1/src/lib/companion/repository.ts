import "server-only";

import { weekKey } from "@/lib/companion/game-engine";
import type { CompanionPersisted } from "@/lib/companion/game-engine";
import { parsePersistedRow } from "@/lib/companion/game-engine";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";

type DbRow = {
  user_id: string;
  pokemon_id: number;
  pokemon_name: string;
  pokemon_slug: string;
  pokemon_tier: string;
  pokemon_era: string;
  hatched_at: string;
  level: number;
  xp: number;
  hunger: number;
  energy: number;
  mood: number;
  last_tick_at: string;
  action_cooldowns: Record<string, string | null>;
  task_progress: Record<string, number>;
  task_claimed: Record<string, string | null>;
  lifetime_stats: CompanionPersisted["lifetime"];
  usage_scans_this_week: number;
  usage_week_key: string;
};

function rowToPersisted(row: DbRow): CompanionPersisted {
  return parsePersistedRow({
    pokemonId: row.pokemon_id,
    pokemonName: row.pokemon_name,
    pokemonSlug: row.pokemon_slug,
    pokemonTier: row.pokemon_tier,
    pokemonEra: row.pokemon_era,
    hatchedAt: row.hatched_at,
    level: row.level,
    xp: row.xp,
    hunger: row.hunger,
    energy: row.energy,
    mood: row.mood,
    lastTickAt: row.last_tick_at,
    actionCooldowns: row.action_cooldowns,
    taskProgress: row.task_progress,
    taskClaimed: row.task_claimed,
    lifetime: row.lifetime_stats,
    usageScansThisWeek: row.usage_scans_this_week,
    usageWeekKey: row.usage_week_key,
  })!;
}

function isMissingCompanionTableError(error: { code?: string; message?: string }): boolean {
  const msg = (error.message ?? "").toLowerCase();
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    (msg.includes("user_companions") &&
      (msg.includes("does not exist") || msg.includes("not found") || msg.includes("schema cache")))
  );
}

function persistedToDb(userId: string, row: CompanionPersisted): Omit<DbRow, "user_id"> & { user_id: string } {
  return {
    user_id: userId,
    pokemon_id: row.pokemonId,
    pokemon_name: row.pokemonName,
    pokemon_slug: row.pokemonSlug,
    pokemon_tier: row.pokemonTier,
    pokemon_era: row.pokemonEra,
    hatched_at: row.hatchedAt,
    level: row.level,
    xp: row.xp,
    hunger: row.hunger,
    energy: row.energy,
    mood: row.mood,
    last_tick_at: row.lastTickAt,
    action_cooldowns: row.actionCooldowns,
    task_progress: row.taskProgress,
    task_claimed: row.taskClaimed,
    lifetime_stats: row.lifetime,
    usage_scans_this_week: row.usageScansThisWeek,
    usage_week_key: row.usageWeekKey,
  };
}

export async function getCompanionRow(userId: string): Promise<CompanionPersisted | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("user_companions")
    .select(
      "user_id, pokemon_id, pokemon_name, pokemon_slug, pokemon_tier, pokemon_era, hatched_at, level, xp, hunger, energy, mood, last_tick_at, action_cooldowns, task_progress, task_claimed, lifetime_stats, usage_scans_this_week, usage_week_key",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (isMissingCompanionTableError(error)) return null;
    throw error;
  }
  if (!data) return null;
  return rowToPersisted(data as DbRow);
}

/** Returns true when the row was saved to Supabase. */
export async function saveCompanionRow(userId: string, row: CompanionPersisted): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const supabase = getSupabaseAdmin();
  const payload = persistedToDb(userId, row);
  const { error } = await supabase.from("user_companions").upsert(payload, { onConflict: "user_id" });
  if (error) {
    if (isMissingCompanionTableError(error)) return false;
    throw error;
  }
  return true;
}

export async function countVisionScansThisWeek(userId: string): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  const supabase = getSupabaseAdmin();
  const wk = weekKey();
  const { count, error } = await supabase
    .from("usage_ledger")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("event_type", "vision_scan")
    .gte("created_at", `${wk}T00:00:00.000Z`);

  if (error) return 0;
  return count ?? 0;
}
