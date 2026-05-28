import { pokeTraceGet } from "@/lib/market/poketrace/client";
import { isPokeTraceAnomaly, pokeTraceTrendPct } from "@/lib/market/poketrace/tiers";
import type {
  PokeTraceCard,
  PokeTraceHistoryPoint,
  PokeTracePriceSource,
} from "@/lib/market/poketrace/types";
import type { MarketEvidence } from "@/lib/scan/schemas";

type HistoryResponse = { data?: PokeTraceHistoryPoint[] };

function historyPointUsd(point: PokeTraceHistoryPoint): number | null {
  const candidates = [point.median7d, point.avg7d, point.median30d, point.avg30d, point.avg];
  for (const value of candidates) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return Math.round(value * 100) / 100;
    }
  }
  return null;
}

export async function fetchPokeTracePriceHistory(
  cardId: string,
  tier: string,
  options?: { period?: string; limit?: number },
): Promise<PokeTraceHistoryPoint[]> {
  const id = cardId.trim();
  const tierKey = tier.trim();
  if (!id || !tierKey) return [];

  const payload = await pokeTraceGet<HistoryResponse>(
    `/cards/${encodeURIComponent(id)}/prices/${encodeURIComponent(tierKey)}/history`,
    {
      period: options?.period ?? "90d",
      limit: options?.limit ?? 30,
    },
  );
  return Array.isArray(payload?.data) ? payload.data : [];
}

export function historyTrendPct(points: PokeTraceHistoryPoint[]): number | null {
  const priced = points
    .map((p) => ({ date: p.date, usd: historyPointUsd(p) }))
    .filter((p): p is { date: string; usd: number } => p.usd != null)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (priced.length < 2) return null;
  const first = priced[0]!.usd;
  const last = priced[priced.length - 1]!.usd;
  if (first <= 0) return null;
  return Math.round(((last - first) / first) * 1000) / 10;
}

export function historyToMarketEvidence(args: {
  card: PokeTraceCard;
  tier: string;
  sourceKey: PokeTracePriceSource;
  points: PokeTraceHistoryPoint[];
  cardUrl: string | null;
}): MarketEvidence[] {
  const { card, tier, sourceKey, points, cardUrl } = args;
  if (points.length < 2) return [];

  const sorted = [...points]
    .map((p) => ({ point: p, usd: historyPointUsd(p) }))
    .filter((row): row is { point: PokeTraceHistoryPoint; usd: number } => row.usd != null)
    .sort((a, b) => a.point.date.localeCompare(b.point.date));

  if (sorted.length < 2) return [];

  const oldest = sorted[0]!;
  const newest = sorted[sorted.length - 1]!;
  const trendPct = historyTrendPct(points);
  const syntheticRow = {
    avg: newest.usd,
    median7d: newest.point.median7d,
    median30d: oldest.usd,
    median3d: newest.point.median7d ?? newest.usd,
  };
  const anomalyFlag = isPokeTraceAnomaly(syntheticRow);

  return [
    {
      kind: "reference",
      title: `${card.name} — ${tier.replace(/_/g, " ")} (PokeTrace history ${oldest.point.date}→${newest.point.date})`,
      priceUsd: newest.usd,
      observedAt: newest.point.date,
      url: cardUrl,
      source: "PokeTrace",
      confidence: Math.min(1, sorted.length / 20),
      trendPct: trendPct ?? pokeTraceTrendPct(syntheticRow) ?? undefined,
      anomalyFlag,
      priceWindow: "history",
      externalRef: `${card.id}|${sourceKey}|${tier}|history`,
    },
  ];
}
