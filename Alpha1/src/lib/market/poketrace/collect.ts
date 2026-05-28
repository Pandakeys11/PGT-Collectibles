import type { MarketApiAdapter, ApiAdapterResult } from "@/lib/market/adapters/types";
import { isPokeTraceConfigured, isPokeTraceHistoryEnabled } from "@/lib/market/env-market";
import {
  fetchPokeTracePriceHistory,
  historyToMarketEvidence,
} from "@/lib/market/poketrace/history";
import {
  fetchPokeTraceCardById,
  observedAtFromCard,
  pokeTraceCardUrl,
  scoreCardMatch,
  searchPokeTraceCards,
} from "@/lib/market/poketrace/match";
import {
  isPokeTraceAnomaly,
  pickPriceUsd,
  pickPrimaryTierRow,
  pickTierPrices,
  POKETRACE_PRICE_SOURCES,
  pokeTraceTrendPct,
  saleCountForRow,
  slabLabelForTier,
  tierForLane,
  tierToGradeBucket,
} from "@/lib/market/poketrace/tiers";
import type {
  PokeTraceCard,
  PokeTracePriceSource,
  PokeTraceTierPrice,
} from "@/lib/market/poketrace/types";
import type { ExtractedCard, MarketEvidence } from "@/lib/scan/schemas";

function evidenceKindForSource(
  sourceKey: PokeTracePriceSource,
  sales: number,
): MarketEvidence["kind"] {
  if (sourceKey === "ebay" && sales > 0) return "sold";
  if (sourceKey === "cardmarket") return "reference";
  if (sourceKey === "cardmarket_unsold" || sourceKey === "tcgplayer") return "active";
  return sales > 0 ? "sold" : "reference";
}

function sourceLabel(sourceKey: PokeTracePriceSource): string {
  switch (sourceKey) {
    case "ebay":
      return "eBay sold";
    case "tcgplayer":
      return "TCGPlayer";
    case "cardmarket":
      return "CardMarket trend";
    case "cardmarket_unsold":
      return "CardMarket listing";
    default:
      return sourceKey;
  }
}

function pushTierEvidence(
  evidence: MarketEvidence[],
  card: PokeTraceCard,
  sourceKey: PokeTracePriceSource,
  tier: string,
  row: PokeTraceTierPrice,
  options?: { eurNote?: boolean; priceWindow?: MarketEvidence["priceWindow"] },
): void {
  const priceUsd = pickPriceUsd(row, options?.priceWindow === "30d" ? "30d" : "spot");
  if (priceUsd == null) return;

  const sales = saleCountForRow(row);
  const label = sourceLabel(sourceKey);
  const kind = evidenceKindForSource(sourceKey, sales);
  const eurSuffix = options?.eurNote ? " EUR≈USD" : "";
  const trendPct = pokeTraceTrendPct(row);
  const anomalyFlag = isPokeTraceAnomaly(row);

  evidence.push({
    kind,
    title: `${card.name} — ${tier.replace(/_/g, " ")} (${label}${eurSuffix}, n=${sales})`,
    priceUsd,
    observedAt: observedAtFromCard(card),
    url: pokeTraceCardUrl(card),
    source: "PokeTrace",
    slab: slabLabelForTier(tier),
    gradeBucket: tierToGradeBucket(tier),
    confidence: Math.min(1, (sales + 2) / 25),
    trendPct: trendPct ?? undefined,
    anomalyFlag: anomalyFlag || undefined,
    priceWindow: options?.priceWindow ?? "spot",
    externalRef: `${card.id}|${sourceKey}|${tier}`,
  });

  const price7d = pickPriceUsd(row, "7d");
  if (price7d != null && price7d !== priceUsd) {
    evidence.push({
      kind,
      title: `${card.name} — ${tier.replace(/_/g, " ")} (${label} 7d median)`,
      priceUsd: price7d,
      observedAt: observedAtFromCard(card),
      url: pokeTraceCardUrl(card),
      source: "PokeTrace",
      slab: slabLabelForTier(tier),
      gradeBucket: tierToGradeBucket(tier),
      confidence: Math.min(1, (sales + 1) / 30),
      trendPct: trendPct ?? undefined,
      priceWindow: "7d",
      externalRef: `${card.id}|${sourceKey}|${tier}|7d`,
    });
  }
}

export function collectEvidenceFromPokeTraceCard(
  best: PokeTraceCard,
  card: ExtractedCard,
): MarketEvidence[] {
  const evidence: MarketEvidence[] = [];
  const tiers = tierForLane(card);
  const eurSources: PokeTracePriceSource[] = ["cardmarket", "cardmarket_unsold"];

  for (const sourceKey of POKETRACE_PRICE_SOURCES) {
    const tierRows = pickTierPrices(
      best.prices?.[sourceKey] as Record<string, unknown> | undefined,
      tiers,
    );
    for (const { tier, row } of tierRows) {
      pushTierEvidence(evidence, best, sourceKey, tier, row, {
        eurNote: eurSources.includes(sourceKey),
      });
    }
  }

  return evidence;
}

async function appendHistoryEvidence(
  evidence: MarketEvidence[],
  best: PokeTraceCard,
  card: ExtractedCard,
): Promise<void> {
  if (!isPokeTraceHistoryEnabled()) return;
  const primary = pickPrimaryTierRow(card, best);
  if (!primary) return;

  const points = await fetchPokeTracePriceHistory(best.id, primary.tier, {
    period: "90d",
    limit: 30,
  });
  evidence.push(
    ...historyToMarketEvidence({
      card: best,
      tier: primary.tier,
      sourceKey: primary.sourceKey,
      points,
      cardUrl: pokeTraceCardUrl(best),
    }),
  );
}

export async function collectPokeTraceMarketEvidence(
  card: ExtractedCard,
  options?: { pokeTraceId?: string | null },
): Promise<ApiAdapterResult> {
  if (!isPokeTraceConfigured()) {
    return { adapter: "poketrace", evidence: [] };
  }

  const warnings: string[] = [];
  try {
    const storedId = options?.pokeTraceId?.trim();
    let best: PokeTraceCard | null = storedId ? await fetchPokeTraceCardById(storedId) : null;

    if (!best) {
      const candidates = await searchPokeTraceCards(card);
      if (!candidates.length) {
        warnings.push("PokeTrace returned no cards for this query.");
        return { adapter: "poketrace", evidence: [], warnings };
      }
      const ranked = candidates
        .map((c) => ({ c, score: scoreCardMatch(c, card) }))
        .sort((a, b) => b.score - a.score);
      best = ranked[0]?.c ?? null;
      if (!best || (ranked[0]?.score ?? 0) < 4) {
        warnings.push("PokeTrace matches were too weak to trust.");
        return { adapter: "poketrace", evidence: [], warnings };
      }
    }

    const evidence = collectEvidenceFromPokeTraceCard(best, card);
    await appendHistoryEvidence(evidence, best, card);

    if (!evidence.length) {
      warnings.push("PokeTrace matched a card but returned no usable price tiers.");
    }

    return {
      adapter: "poketrace",
      evidence,
      warnings: warnings.length ? warnings : undefined,
    };
  } catch (e) {
    warnings.push(e instanceof Error ? e.message : "PokeTrace request failed");
    return { adapter: "poketrace", evidence: [], warnings };
  }
}

export const poketraceAdapter: MarketApiAdapter = {
  id: "poketrace",
  collect(card) {
    return collectPokeTraceMarketEvidence(card);
  },
};

export async function fetchPokeTraceEvidenceForCard(
  card: ExtractedCard,
  options?: { pokeTraceId?: string | null },
): Promise<MarketEvidence[]> {
  const result = await collectPokeTraceMarketEvidence(card, options);
  return result.evidence;
}

export { fetchPokeTraceCardById, searchPokeTraceCards } from "@/lib/market/poketrace/match";
