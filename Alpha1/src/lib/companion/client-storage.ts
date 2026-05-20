import type { CompanionPersisted } from "@/lib/companion/game-engine";
import { parsePersistedRow } from "@/lib/companion/game-engine";

const STORAGE_KEY = "pgt_companion_v1";

export function loadCompanionLocal(clerkUserId: string | null): CompanionPersisted | null {
  if (typeof window === "undefined" || !clerkUserId) return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}:${clerkUserId}`);
    if (!raw) return null;
    return parsePersistedRow(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveCompanionLocal(clerkUserId: string, row: CompanionPersisted): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(`${STORAGE_KEY}:${clerkUserId}`, JSON.stringify(row));
}

export function clearCompanionLocal(clerkUserId: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(`${STORAGE_KEY}:${clerkUserId}`);
}
