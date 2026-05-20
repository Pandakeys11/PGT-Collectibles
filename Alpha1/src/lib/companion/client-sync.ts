import type { CompanionPersisted } from "@/lib/companion/game-engine";
import { applyTimeDecay, parsePersistedRow } from "@/lib/companion/game-engine";
import { loadCompanionLocal, saveCompanionLocal } from "@/lib/companion/client-storage";
import type { CompanionState } from "@/lib/companion/schemas";
import { readResponseJson } from "@/lib/http/read-response-json";

export function getLocalCompanion(userId: string | null | undefined): CompanionPersisted | null {
  if (!userId) return null;
  const row = loadCompanionLocal(userId);
  return row ? applyTimeDecay(row) : null;
}

export function saveLocalCompanion(userId: string, row: CompanionPersisted): void {
  saveCompanionLocal(userId, row);
}

export function companionFromApiPayload(
  userId: string,
  data: { state?: CompanionState; companion?: CompanionPersisted },
): void {
  if (data.companion) {
    saveCompanionLocal(userId, data.companion);
    return;
  }
  if (!data.state?.hatched) return;
  const row = parsePersistedRow({
    pokemonId: data.state.pokemonId,
    pokemonName: data.state.pokemonName,
    pokemonSlug: data.state.pokemonSlug,
    pokemonTier: data.state.pokemonTier,
    pokemonEra: data.state.pokemonEra,
    hatchedAt: data.state.hatchedAt,
    level: data.state.level,
    xp: data.state.xp,
    hunger: data.state.hunger,
    energy: data.state.energy,
    mood: data.state.mood,
    lastTickAt: data.state.lastTickAt,
  });
  if (row) saveCompanionLocal(userId, row);
}

export async function pushLocalCompanionToServer(
  userId: string,
  row: CompanionPersisted,
): Promise<boolean> {
  try {
    const res = await fetch("/api/companion/sync", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companion: row }),
    });
    if (!res.ok) return false;
    const data = await readResponseJson<{ state?: CompanionState; companion?: CompanionPersisted }>(res);
    if (data.companion) saveCompanionLocal(userId, data.companion);
    return true;
  } catch {
    return false;
  }
}
