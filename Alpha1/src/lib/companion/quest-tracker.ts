"use client";

import type { CompanionPersisted } from "@/lib/companion/game-engine";
import type { CompanionQuestEvent, CompanionState } from "@/lib/companion/schemas";
import { companionFromApiPayload, getLocalCompanion } from "@/lib/companion/client-sync";
import { readResponseJson } from "@/lib/http/read-response-json";

/** Fire-and-forget companion quest progress (scan, market intel, catalog lock). */
export async function trackCompanionQuest(
  userId: string,
  event: CompanionQuestEvent,
  amount = 1,
): Promise<void> {
  const companion = getLocalCompanion(userId);
  if (!companion) return;

  try {
    await fetch("/api/companion/quest-event", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, amount, companion } satisfies {
        event: CompanionQuestEvent;
        amount: number;
        companion: CompanionPersisted;
      }),
    }).then(async (res) => {
      if (!res.ok) return;
      const data = await readResponseJson<{ companion?: CompanionPersisted; state?: CompanionState }>(res);
      companionFromApiPayload(userId, data);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("companion-quest-updated"));
      }
    });
  } catch {
    // Non-fatal — quest will catch up on next companion refresh.
  }
}
