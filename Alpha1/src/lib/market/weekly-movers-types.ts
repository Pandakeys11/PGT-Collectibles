/** Client-safe weekly movers types — no server/Node imports. */

export type WeeklyMoverCard = {
  catalogId: string;
  name: string;
  setName: string;
  setCode: string | null;
  cardNumber: string | null;
  rarity: string | null;
  imageUrl: string | null;
  priceUsd: number | null;
  priceLabel?: string | null;
  momentumPct: number;
  momentumLabel: string | null;
  momentumRegion?: "us" | "eu" | null;
  deltaUsd: number | null;
};

export type MoversSignalKind = "strong" | "weak" | "none";

export function moversSignalSubtitle(signalKind?: MoversSignalKind): string | null {
  if (signalKind === "weak") {
    return "Moves below ±3% vs 30-day median — showing the largest shifts in this set.";
  }
  if (signalKind === "strong") {
    return "7-day vs 30-day median · US TCGPlayer/eBay when PokeTrace is configured, else EU Cardmarket.";
  }
  return null;
}

export type WeeklyMoversPayload = {
  ready: boolean;
  refreshedAt: string;
  increases: WeeklyMoverCard[];
  decreases: WeeklyMoverCard[];
  momentumUsCount?: number;
  momentumEuCount?: number;
  signalKind?: MoversSignalKind;
  error?: string | null;
};
