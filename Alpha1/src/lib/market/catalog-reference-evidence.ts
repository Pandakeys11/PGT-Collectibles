import type { CatalogCardSummary } from "@/lib/catalog/catalog-types";
import type { CatalogPriceSnapshot, TcgPlayerVariantPrice } from "@/lib/market/pokemon-catalog";
import type { MarketEvidence } from "@/lib/scan/schemas";

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

function parseTcgPlayerVariants(raw: unknown): TcgPlayerVariantPrice[] {
  if (!Array.isArray(raw)) return [];
  const out: TcgPlayerVariantPrice[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const v = row as Record<string, unknown>;
    const variant = typeof v.variant === "string" ? v.variant : null;
    if (!variant) continue;
    out.push({
      variant,
      low: asNumber(v.low),
      mid: asNumber(v.mid),
      high: asNumber(v.high),
      market: asNumber(v.market),
      directLow: asNumber(v.directLow),
    });
  }
  return out;
}

export function parseCatalogPriceSnapshot(
  pricesJson: Record<string, unknown> | null | undefined,
): CatalogPriceSnapshot {
  const p = pricesJson ?? {};
  const cm = p.cardMarket;
  const cardMarket =
    cm && typeof cm === "object"
      ? {
          averageSellPrice: asNumber((cm as Record<string, unknown>).averageSellPrice),
          trendPrice: asNumber((cm as Record<string, unknown>).trendPrice),
          lowPrice: asNumber((cm as Record<string, unknown>).lowPrice),
          avg7: asNumber((cm as Record<string, unknown>).avg7),
          avg30: asNumber((cm as Record<string, unknown>).avg30),
          reverseHoloTrend: asNumber((cm as Record<string, unknown>).reverseHoloTrend),
        }
      : null;

  return {
    tcgPlayerUrl: typeof p.tcgPlayerUrl === "string" ? p.tcgPlayerUrl : null,
    tcgPlayerUpdatedAt: typeof p.tcgPlayerUpdatedAt === "string" ? p.tcgPlayerUpdatedAt : null,
    tcgPlayerPrices: parseTcgPlayerVariants(p.tcgPlayerPrices),
    cardMarketUrl: typeof p.cardMarketUrl === "string" ? p.cardMarketUrl : null,
    cardMarketUpdatedAt: typeof p.cardMarketUpdatedAt === "string" ? p.cardMarketUpdatedAt : null,
    cardMarket,
  };
}

function variantLabel(variant: string): string {
  return variant
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}

function safeDate(updatedAt: string | null): string | null {
  if (!updatedAt?.trim()) return null;
  const trimmed = updatedAt.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  if (/^\d{4}\/\d{2}\/\d{2}/.test(trimmed)) return trimmed.slice(0, 10).replace(/\//g, "-");
  return null;
}

/** Institutional reference rows from cached TCGPlayer / CardMarket prices. */
export function catalogReferenceEvidence(
  cardName: string,
  prices: CatalogPriceSnapshot,
): MarketEvidence[] {
  const evidence: MarketEvidence[] = [];
  const observedTcg = safeDate(prices.tcgPlayerUpdatedAt);
  const observedCm = safeDate(prices.cardMarketUpdatedAt);

  if (prices.tcgPlayerUrl) {
    for (const variant of prices.tcgPlayerPrices) {
      const label = variantLabel(variant.variant);
      if (variant.market != null) {
        evidence.push({
          kind: "active",
          title: `${cardName} — ${label} (TCGPlayer market)`,
          priceUsd: variant.market,
          observedAt: observedTcg,
          url: prices.tcgPlayerUrl,
          source: "TCGPlayer",
          slab: null,
        });
      }
      if (variant.mid != null) {
        evidence.push({
          kind: "reference",
          title: `${cardName} — ${label} (TCGPlayer mid)`,
          priceUsd: variant.mid,
          observedAt: observedTcg,
          url: prices.tcgPlayerUrl,
          source: "TCGPlayer",
          slab: null,
        });
      }
    }
  }

  const cm = prices.cardMarket;
  if (prices.cardMarketUrl && cm) {
    if (cm.trendPrice != null) {
      evidence.push({
        kind: "reference",
        title: `${cardName} — CardMarket trend`,
        priceUsd: cm.trendPrice,
        observedAt: observedCm,
        url: prices.cardMarketUrl,
        source: "CardMarket",
        slab: null,
      });
    }
    if (cm.avg30 != null) {
      evidence.push({
        kind: "reference",
        title: `${cardName} — CardMarket 30d avg`,
        priceUsd: cm.avg30,
        observedAt: observedCm,
        url: prices.cardMarketUrl,
        source: "CardMarket",
        slab: null,
      });
    }
  }

  return evidence;
}

export function catalogCardReferenceEvidence(card: CatalogCardSummary): MarketEvidence[] {
  const prices = card.prices ?? parseCatalogPriceSnapshot(null);
  return catalogReferenceEvidence(card.name, prices);
}
