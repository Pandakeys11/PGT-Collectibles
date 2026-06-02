import {
  inferCardTargetGradeBucket,
  type GradeBucket,
} from "@/lib/market/market-intelligence";
import { resolvePrintEdition } from "@/lib/scan/print-edition";
import type { ExtractedCard } from "@/lib/scan/schemas";
import type {
  PokeTracePriceSource,
  PokeTraceTierPrice,
} from "@/lib/market/poketrace/types";

export const POKETRACE_PRICE_SOURCES: PokeTracePriceSource[] = [
  "ebay",
  "tcgplayer",
  "cardmarket",
  "cardmarket_unsold",
];

/** US lanes for 7d vs 30d momentum (never Cardmarket EU). */
export const US_MOMENTUM_SOURCES: PokeTracePriceSource[] = ["tcgplayer", "ebay"];

export function isJapaneseCard(card: ExtractedCard): boolean {
  const set = `${card.set ?? ""} ${card.details ?? ""}`.toLowerCase();
  return /japanese|japan|日本|sv\d+[a-z]?$/i.test(set) || /\bjp\b/.test(set);
}

export function gameForCard(card: ExtractedCard): string {
  return isJapaneseCard(card) ? "pokemon-japanese" : "pokemon";
}

export function marketForCard(card: ExtractedCard): "US" | "EU" {
  return isJapaneseCard(card) ? "EU" : "US";
}

export function variantForCard(card: ExtractedCard): string | undefined {
  const edition = resolvePrintEdition(card);
  if (!edition) return undefined;
  switch (edition.id) {
    case "first_edition":
      return /holo/i.test(`${card.details ?? ""} ${card.printStamps ?? ""}`)
        ? "1st_Edition_Holofoil"
        : "1st_Edition";
    case "reverse_holo":
      return "Reverse_Holofoil";
    case "holo":
      return "Holofoil";
    default:
      return undefined;
  }
}

export function tierForLane(card: ExtractedCard): string[] {
  const bucket = inferCardTargetGradeBucket(card);
  if (bucket === "psa10") {
    return ["PSA_10", "BGS_10", "CGC_10", "SGC_10", "ACE_10", "TAG_10", "GEM_MINT", "MINT"];
  }
  if (bucket === "psa9") return ["PSA_9", "PSA_9_5", "NEAR_MINT"];
  if (bucket === "bgsBlackLabel") return ["BGS_10_BL", "BGS_10", "BGS_9_5"];
  if (bucket === "bgs10") return ["BGS_10", "BGS_9_5", "BGS_10_BL"];
  if (bucket === "cgcPristine10") return ["CGC_10_PRISTINE", "CGC_10", "CGC_9_5"];
  if (bucket === "cgc10") return ["CGC_10", "CGC_9_5", "CGC_10_PRISTINE"];
  if (bucket === "tag10") return ["TAG_10", "PSA_10"];
  if (bucket === "gradedOther") {
    return ["PSA_10", "PSA_9", "BGS_10", "CGC_10", "SGC_10"];
  }
  return [
    "NEAR_MINT",
    "LIGHTLY_PLAYED",
    "MODERATELY_PLAYED",
    "HEAVILY_PLAYED",
    "DAMAGED",
    "MINT",
    "AGGREGATED",
  ];
}

export function resolveTierRow(value: unknown): PokeTraceTierPrice | null {
  if (!value || typeof value !== "object") return null;
  const row = value as PokeTraceTierPrice;
  if (
    typeof row.avg === "number" ||
    typeof row.median7d === "number" ||
    typeof row.median30d === "number" ||
    typeof row.avg7d === "number"
  ) {
    return row;
  }
  for (const child of Object.values(value as Record<string, unknown>)) {
    const found = resolveTierRow(child);
    if (found) return found;
  }
  return null;
}

export function pickSpotUsd(row: PokeTraceTierPrice): number | null {
  const candidates = [row.avg, row.median7d, row.avg7d];
  for (const value of candidates) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return Math.round(value * 100) / 100;
    }
  }
  return null;
}

export function pickPriceUsd(row: PokeTraceTierPrice, window: "spot" | "7d" | "30d" = "spot"): number | null {
  if (window === "7d") {
    const v = row.median7d ?? row.avg7d;
    if (typeof v === "number" && Number.isFinite(v)) return Math.round(v * 100) / 100;
  }
  if (window === "30d") {
    const v = row.median30d ?? row.avg30d;
    if (typeof v === "number" && Number.isFinite(v)) return Math.round(v * 100) / 100;
  }
  const candidates = [row.median7d, row.avg7d, row.median30d, row.avg30d, row.avg];
  for (const value of candidates) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return Math.round(value * 100) / 100;
    }
  }
  return null;
}

export function saleCountForRow(row: PokeTraceTierPrice): number {
  if (typeof row.saleCount === "number" && Number.isFinite(row.saleCount)) return row.saleCount;
  if (typeof row.approxSaleCount === "number" && Number.isFinite(row.approxSaleCount)) {
    return row.approxSaleCount;
  }
  return 0;
}

/** PokeTrace excludes anomalies from medians; flag when spot diverges from 3d median. */
export function isPokeTraceAnomaly(row: PokeTraceTierPrice): boolean {
  const spot = pickSpotUsd(row);
  const median3d = row.median3d;
  if (spot == null || median3d == null || median3d <= 0) return false;
  return spot < median3d * 0.1 || spot > median3d * 10;
}

export function pokeTraceTrendPct(row: PokeTraceTierPrice): number | null {
  const short = row.median7d ?? row.avg7d ?? row.avg1d;
  const long = row.median30d ?? row.avg30d;
  if (short == null || long == null || long <= 0) return null;
  return Math.round(((short - long) / long) * 1000) / 10;
}

export function trendLabelFromPct(pct: number | null): "up" | "down" | "flat" | null {
  if (pct == null) return null;
  if (pct >= 3) return "up";
  if (pct <= -3) return "down";
  return "flat";
}

export function tierToGradeBucket(tier: string): GradeBucket | undefined {
  if (/^PSA_10$/i.test(tier) || /GEM_MINT/i.test(tier)) return "psa10";
  if (/^PSA_9/i.test(tier)) return "psa9";
  if (/BGS.*BL/i.test(tier)) return "bgsBlackLabel";
  if (/^BGS_10/i.test(tier)) return "bgs10";
  if (/CGC.*PRISTINE/i.test(tier)) return "cgcPristine10";
  if (/^CGC_10/i.test(tier)) return "cgc10";
  if (/^TAG_10/i.test(tier)) return "tag10";
  if (/PSA|BGS|CGC|SGC|ACE|TAG/i.test(tier)) return "gradedOther";
  if (/MINT|NEAR_MINT|PLAYED|DAMAGED|EXCELLENT/i.test(tier)) return "raw";
  return undefined;
}

export function slabLabelForTier(tier: string): string | null {
  const bucket = tierToGradeBucket(tier);
  if (bucket === "psa10") return "PSA 10";
  if (bucket === "psa9") return "PSA 9";
  if (bucket === "bgsBlackLabel") return "BGS Black Label";
  if (bucket === "cgcPristine10") return "CGC Pristine 10";
  if (bucket === "bgs10") return "BGS 10";
  if (bucket === "cgc10") return "CGC 10";
  if (bucket === "tag10") return "TAG 10";
  if (bucket === "gradedOther") return tier.replace(/_/g, " ");
  return null;
}

export function pickTierPrices(
  prices: Record<string, unknown> | undefined,
  preferred: string[],
): Array<{ tier: string; row: PokeTraceTierPrice }> {
  if (!prices) return [];
  const out: Array<{ tier: string; row: PokeTraceTierPrice }> = [];
  for (const tier of preferred) {
    const row = resolveTierRow(prices[tier]);
    if (row && pickPriceUsd(row) != null) out.push({ tier, row });
  }
  if (out.length) return out;
  for (const [tier, raw] of Object.entries(prices)) {
    if (tier === "AGGREGATED") continue;
    const row = resolveTierRow(raw);
    if (row && pickPriceUsd(row) != null) out.push({ tier, row });
  }
  if (!out.length && prices.AGGREGATED) {
    const row = resolveTierRow(prices.AGGREGATED);
    if (row && pickPriceUsd(row) != null) out.push({ tier: "AGGREGATED", row });
  }
  return out.slice(0, 6);
}

export function pickPrimaryTierRow(
  card: ExtractedCard,
  pokeCard: { prices?: Partial<Record<PokeTracePriceSource, Record<string, unknown>>> },
): { tier: string; sourceKey: PokeTracePriceSource; row: PokeTraceTierPrice } | null {
  const preferred = tierForLane(card);
  for (const sourceKey of POKETRACE_PRICE_SOURCES) {
    const rows = pickTierPrices(pokeCard.prices?.[sourceKey], preferred);
    if (rows[0]) return { ...rows[0], sourceKey };
  }
  return null;
}

/** Best US tier row for 7d vs 30d momentum (TCGPlayer, then eBay). */
export function pickUsMomentumTierRow(
  card: ExtractedCard,
  pokeCard: { prices?: Partial<Record<PokeTracePriceSource, Record<string, unknown>>> },
): { tier: string; sourceKey: PokeTracePriceSource; row: PokeTraceTierPrice } | null {
  const preferred = tierForLane(card);
  for (const sourceKey of US_MOMENTUM_SOURCES) {
    const rows = pickTierPrices(pokeCard.prices?.[sourceKey], preferred);
    if (rows[0]) return { ...rows[0], sourceKey };
  }
  return null;
}
