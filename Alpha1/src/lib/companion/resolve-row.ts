import "server-only";

import { applyTimeDecay, parsePersistedRow, type CompanionPersisted } from "@/lib/companion/game-engine";
import { getCompanionRow, saveCompanionRow } from "@/lib/companion/repository";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

/** Load companion from DB, or fall back to client snapshot and try to persist it. */
export async function resolveCompanionRow(
  appUserId: string,
  clientRow?: CompanionPersisted | null,
): Promise<{ row: CompanionPersisted | null; persistMode: "database" | "local" }> {
  let dbRow: CompanionPersisted | null = null;
  try {
    const raw = await getCompanionRow(appUserId);
    if (raw) dbRow = applyTimeDecay(raw);
  } catch (err) {
    console.error("[companion] resolveCompanionRow db read", err);
  }

  if (dbRow) {
    return { row: dbRow, persistMode: "database" };
  }

  if (!clientRow) {
    return { row: null, persistMode: "local" };
  }

  const row = applyTimeDecay(clientRow);
  if (isSupabaseConfigured()) {
    const saved = await saveCompanionRow(appUserId, row);
    return { row, persistMode: saved ? "database" : "local" };
  }

  return { row, persistMode: "local" };
}

export function parseClientCompanion(raw: unknown): CompanionPersisted | null {
  return parsePersistedRow(raw);
}
