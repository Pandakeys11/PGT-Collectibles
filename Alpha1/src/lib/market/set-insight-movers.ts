import type { SetInsightPriceCard } from "@/lib/catalog/set-insight-payload";
import type { WeeklyMoverCard, WeeklyMoversPayload } from "@/lib/market/weekly-movers-types";

export function insightRowToWeeklyMover(row: SetInsightPriceCard, setName: string): WeeklyMoverCard {
  return {
    catalogId: row.catalogId!,
    name: row.name,
    setName,
    setCode: null,
    cardNumber: row.number ?? null,
    rarity: row.rarity ?? null,
    imageUrl: row.imageUrl ?? null,
    priceUsd: row.priceUsd ?? null,
    priceLabel: row.priceLabel ?? null,
    momentumPct: row.momentumPct ?? 0,
    momentumLabel: row.momentumLabel ?? null,
    momentumRegion: row.momentumRegion ?? null,
    deltaUsd: row.momentumDeltaUsd ?? null,
  };
}

/** Split set-insight momentum rows into ranked up/down columns (same rules as set-movers API). */
export function splitSetInsightMovers(
  setName: string,
  rows: SetInsightPriceCard[],
  columnSize: number,
): Pick<WeeklyMoversPayload, "increases" | "decreases" | "momentumUsCount" | "momentumEuCount"> | null {
  const mapped: WeeklyMoverCard[] = rows
    .filter((r) => r.catalogId && r.momentumPct != null && r.momentumPct !== 0)
    .map((r) => insightRowToWeeklyMover(r, setName));

  if (!mapped.length) return null;

  const increases = mapped
    .filter((r) => r.momentumPct > 0)
    .sort((a, b) => b.momentumPct - a.momentumPct)
    .slice(0, columnSize);
  const decreases = mapped
    .filter((r) => r.momentumPct < 0)
    .sort((a, b) => a.momentumPct - b.momentumPct)
    .slice(0, columnSize);

  if (!increases.length && !decreases.length) return null;

  let us = 0;
  let eu = 0;
  for (const r of mapped) {
    if (r.momentumRegion === "us") us += 1;
    else if (r.momentumRegion === "eu") eu += 1;
  }

  return { increases, decreases, momentumUsCount: us, momentumEuCount: eu };
}

export function weeklyMoversPayloadFromInsight(
  setName: string,
  rows: SetInsightPriceCard[],
  columnSize: number,
): WeeklyMoversPayload | null {
  const split = splitSetInsightMovers(setName, rows, columnSize);
  if (!split) return null;
  return {
    ready: true,
    refreshedAt: new Date().toISOString(),
    ...split,
  };
}
