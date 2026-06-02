import { isPriceChartingSoldScrapeEnabled } from "@/lib/market/pricecharting/config";
import { findPriceChartingProduct } from "@/lib/market/pricecharting/scrape-product";
import { toPriceChartingHistoryUrl } from "@/lib/market/pricecharting/queries";
import { priceChartingUsdFromEvidence } from "@/lib/market/catalog-raw-fmv";
import type { ExtractedCard, MarketEvidence } from "@/lib/scan/schemas";
import { effectiveCatalogSearchName } from "@/lib/scan/card-display";

function saleDateToIso(saleDate: string | null): string | null {
  if (!saleDate?.trim()) return null;
  const t = saleDate.trim();
  const parsed = Date.parse(t);
  if (Number.isFinite(parsed)) return new Date(parsed).toISOString().slice(0, 10);
  const m = t.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${year}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }
  return null;
}

export function extractedCardToPriceChartingInput(card: ExtractedCard) {
  const name = effectiveCatalogSearchName(card) ?? card.name?.trim() ?? "";
  const stamps = (card.printStamps ?? "").toLowerCase();
  return {
    name,
    setId: card.set ?? null,
    setName: card.set ?? null,
    cardNumber: card.number ?? null,
    isFirstEdition: stamps.includes("1st") || stamps.includes("first edition"),
    isShadowless: stamps.includes("shadowless"),
    isReverseHolofoil: stamps.includes("reverse"),
    isPromo: stamps.includes("promo"),
    gradeLabel: card.grader && card.grade ? `${card.grader} ${card.grade}` : card.grade ?? null,
  };
}

export type PriceChartingSoldHarvest = {
  evidence: MarketEvidence[];
  productUrl: string | null;
  historyUrl: string | null;
  looseGuideUsd: number | null;
  compsCount: number;
};

/**
 * Harvest completed-auction rows from PriceCharting product pages.
 * Primary last-sold lane when eBay Finding/Browse is thin (PGTVision pattern).
 */
export async function harvestPriceChartingSoldEvidence(
  card: ExtractedCard,
): Promise<PriceChartingSoldHarvest> {
  const empty: PriceChartingSoldHarvest = {
    evidence: [],
    productUrl: null,
    historyUrl: null,
    looseGuideUsd: null,
    compsCount: 0,
  };
  if (!isPriceChartingSoldScrapeEnabled()) return empty;
  if (!card.name?.trim()) return empty;

  try {
    const product = await findPriceChartingProduct(extractedCardToPriceChartingInput(card));
    if (!product) return empty;

    const historyUrl = toPriceChartingHistoryUrl(product.productUrl);
    const guideRows: MarketEvidence[] = [];
    const loose =
      product.prices.Ungraded ??
      product.prices.Loose ??
      product.prices["Grade 9"] ??
      null;
    if (loose != null && loose > 0) {
      guideRows.push({
        kind: "reference",
        title: `${product.productName} (loose guide)`,
        priceUsd: loose,
        observedAt: null,
        url: product.productUrl,
        source: "PriceCharting",
        slab: null,
      });
    }

    const soldRows: MarketEvidence[] = product.comparables
      .filter((c) => c.price > 0 && c.url)
      .slice(0, 30)
      .map((comp) => {
        const platform = comp.platform ?? "PriceCharting";
        const viaEbay = platform === "eBay";
        return {
          kind: "sold" as const,
          title: comp.title,
          priceUsd: comp.price,
          observedAt: saleDateToIso(comp.saleDate),
          url: comp.url,
          source: viaEbay ? "PriceCharting · eBay" : `PriceCharting · ${platform}`,
          slab: viaEbay ? null : platform,
        };
      });

    const evidence = [...soldRows, ...guideRows];
    const looseGuideUsd = priceChartingUsdFromEvidence(evidence) ?? loose;

    return {
      evidence,
      productUrl: product.productUrl,
      historyUrl,
      looseGuideUsd,
      compsCount: soldRows.length,
    };
  } catch {
    return empty;
  }
}
