import { franchiseLabel } from "@/lib/scan/franchise";
import type { ExtractedCard } from "@/lib/scan/schemas";

/** Stable client key for FMV history fetches (no Node crypto). */
export function marketHistoryFetchKey(card: ExtractedCard): string {
  return [
    franchiseLabel(card),
    card.name,
    card.set,
    card.number,
    card.year,
    card.grade,
    card.grader,
    card.printStamps,
  ]
    .map((part) => part?.trim().toLowerCase() ?? "")
    .join("|");
}
