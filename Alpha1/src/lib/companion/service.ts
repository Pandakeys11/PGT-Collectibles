import "server-only";

import { auth } from "@clerk/nextjs/server";
import { syncCurrentAppUser } from "@/lib/auth/app-user";
import {
  applyTimeDecay,
  claimTask,
  hatchCompanion,
  performAction,
  recordCompanionQuestEvent,
  recordScanUsage,
  rerollCompanionStarter,
  toCompanionState,
  type CompanionPersisted,
} from "@/lib/companion/game-engine";
import { parseClientCompanion, resolveCompanionRow } from "@/lib/companion/resolve-row";
import type { CompanionActionId, CompanionQuestEvent, CompanionState } from "@/lib/companion/schemas";
import { countVisionScansThisWeek, saveCompanionRow } from "@/lib/companion/repository";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

export type CompanionApiPayload = {
  state: CompanionState;
  databaseConfigured: boolean;
  signedIn: boolean;
  companion?: CompanionPersisted;
};

async function resolveUser() {
  const { userId } = await auth();
  if (!userId) return { signedIn: false as const, appUser: null };
  const appUser = await syncCurrentAppUser();
  return { signedIn: true as const, appUser };
}

async function buildState(
  row: CompanionPersisted | null,
  userId: string | null,
  persistMode?: "database" | "local",
): Promise<CompanionApiPayload> {
  const storage = persistMode ?? (isSupabaseConfigured() && userId ? "database" : "local");
  let scanCount = 0;
  if (userId && isSupabaseConfigured()) {
    scanCount = await countVisionScansThisWeek(userId);
  }
  let adjusted = row;
  if (adjusted && scanCount > adjusted.usageScansThisWeek) {
    adjusted = recordScanUsage(adjusted, scanCount - adjusted.usageScansThisWeek);
    if (userId && storage === "database") {
      await saveCompanionRow(userId, adjusted);
    }
  }

  return {
    state: toCompanionState(adjusted, storage, scanCount),
    databaseConfigured: isSupabaseConfigured(),
    signedIn: Boolean(userId),
    companion: adjusted ?? undefined,
  };
}

export async function getCompanionPayload(
  clientRow?: CompanionPersisted | null,
): Promise<CompanionApiPayload> {
  const { signedIn, appUser } = await resolveUser();
  if (!signedIn || !appUser) {
    return buildState(null, null);
  }
  try {
    const { row, persistMode } = await resolveCompanionRow(appUser.id, clientRow ?? null);
    return buildState(row, appUser.id, persistMode);
  } catch (err) {
    console.error("[companion] getCompanionPayload", err);
    if (clientRow) {
      return buildState(applyTimeDecay(clientRow), appUser.id, "local");
    }
    return buildState(null, appUser.id, "local");
  }
}

export async function hatchCompanionForUser(): Promise<
  | {
      ok: true;
      payload: CompanionApiPayload;
      companion: CompanionPersisted;
      pokemon: { id: number; name: string; slug: string };
    }
  | { ok: false; error: string; status: number }
> {
  const { signedIn, appUser } = await resolveUser();
  if (!signedIn) return { ok: false, error: "Sign in to hatch your partner", status: 401 };
  if (!appUser) return { ok: false, error: "Account not synced — check database config", status: 503 };

  const { row: existing } = await resolveCompanionRow(appUser.id, null);
  if (existing) {
    return { ok: false, error: "You already have a partner", status: 409 };
  }

  const hatched = hatchCompanion();
  const { persistMode } = await resolveCompanionRow(appUser.id, hatched);

  const payload = await buildState(hatched, appUser.id, persistMode);
  return {
    ok: true,
    payload,
    companion: hatched,
    pokemon: { id: hatched.pokemonId, name: hatched.pokemonName, slug: hatched.pokemonSlug },
  };
}

export async function runCompanionAction(
  action: CompanionActionId,
  clientRow?: CompanionPersisted | null,
): Promise<{ ok: true; payload: CompanionApiPayload } | { ok: false; error: string; status: number }> {
  const { signedIn, appUser } = await resolveUser();
  if (!signedIn) return { ok: false, error: "Sign in required", status: 401 };
  if (!appUser) return { ok: false, error: "Account not synced", status: 503 };

  const { row, persistMode } = await resolveCompanionRow(appUser.id, clientRow ?? null);
  if (!row) return { ok: false, error: "Hatch a partner first", status: 404 };

  const result = performAction(row, action);
  if (result.error) return { ok: false, error: result.error, status: 400 };

  const next = result.row;
  if (persistMode === "database" || isSupabaseConfigured()) {
    const saved = await saveCompanionRow(appUser.id, next);
    const mode = saved ? "database" : persistMode;
    const payload = await buildState(next, appUser.id, mode);
    return { ok: true, payload };
  }

  const payload = await buildState(next, appUser.id, "local");
  return { ok: true, payload };
}

export async function claimCompanionTask(
  taskId: string,
  clientRow?: CompanionPersisted | null,
): Promise<{ ok: true; payload: CompanionApiPayload; rewardXp?: number } | { ok: false; error: string; status: number }> {
  const { signedIn, appUser } = await resolveUser();
  if (!signedIn) return { ok: false, error: "Sign in required", status: 401 };
  if (!appUser) return { ok: false, error: "Account not synced", status: 503 };

  const { row, persistMode } = await resolveCompanionRow(appUser.id, clientRow ?? null);
  if (!row) return { ok: false, error: "Hatch a partner first", status: 404 };

  const result = claimTask(row, taskId);
  if (result.error) return { ok: false, error: result.error, status: 400 };

  const next = result.row;
  if (persistMode === "database" || isSupabaseConfigured()) {
    const saved = await saveCompanionRow(appUser.id, next);
    const mode = saved ? "database" : persistMode;
    const payload = await buildState(next, appUser.id, mode);
    return { ok: true, payload, rewardXp: result.rewardXp };
  }

  const payload = await buildState(next, appUser.id, "local");
  return { ok: true, payload, rewardXp: result.rewardXp };
}

export async function syncCompanionFromClient(
  row: CompanionPersisted,
): Promise<{ ok: true; payload: CompanionApiPayload } | { ok: false; error: string; status: number }> {
  const { signedIn, appUser } = await resolveUser();
  if (!signedIn) return { ok: false, error: "Sign in required", status: 401 };
  if (!appUser) return { ok: false, error: "Account not synced", status: 503 };

  const { persistMode } = await resolveCompanionRow(appUser.id, row);
  const payload = await buildState(applyTimeDecay(row), appUser.id, persistMode);
  return { ok: true, payload };
}

export async function rerollCompanionStarterForUser(
  clientRow?: CompanionPersisted | null,
): Promise<
  | {
      ok: true;
      payload: CompanionApiPayload;
      pokemon: { id: number; name: string; slug: string };
    }
  | { ok: false; error: string; status: number }
> {
  const { signedIn, appUser } = await resolveUser();
  if (!signedIn) return { ok: false, error: "Sign in required", status: 401 };
  if (!appUser) return { ok: false, error: "Account not synced", status: 503 };

  const { row, persistMode } = await resolveCompanionRow(appUser.id, clientRow ?? null);
  if (!row) return { ok: false, error: "Hatch a partner first", status: 404 };

  const result = rerollCompanionStarter(row);
  if (result.error) return { ok: false, error: result.error, status: 400 };

  const next = result.row;
  if (persistMode === "database" || isSupabaseConfigured()) {
    const saved = await saveCompanionRow(appUser.id, next);
    const mode = saved ? "database" : persistMode;
    const payload = await buildState(next, appUser.id, mode);
    return {
      ok: true,
      payload,
      pokemon: { id: result.pokemon.id, name: result.pokemon.name, slug: result.pokemon.slug },
    };
  }

  const payload = await buildState(next, appUser.id, "local");
  return {
    ok: true,
    payload,
    pokemon: { id: result.pokemon.id, name: result.pokemon.name, slug: result.pokemon.slug },
  };
}

export async function recordCompanionQuestEventForUser(
  event: CompanionQuestEvent,
  amount: number,
  clientRow?: CompanionPersisted | null,
): Promise<{ ok: true; payload: CompanionApiPayload } | { ok: false; error: string; status: number }> {
  const { signedIn, appUser } = await resolveUser();
  if (!signedIn) return { ok: false, error: "Sign in required", status: 401 };
  if (!appUser) return { ok: false, error: "Account not synced", status: 503 };

  const { row, persistMode } = await resolveCompanionRow(appUser.id, clientRow ?? null);
  if (!row) return { ok: false, error: "Hatch a partner first", status: 404 };

  const next = recordCompanionQuestEvent(row, event, amount);
  if (persistMode === "database" || isSupabaseConfigured()) {
    const saved = await saveCompanionRow(appUser.id, next);
    const mode = saved ? "database" : persistMode;
    const payload = await buildState(next, appUser.id, mode);
    return { ok: true, payload };
  }

  const payload = await buildState(next, appUser.id, "local");
  return { ok: true, payload };
}

export { parseClientCompanion };
