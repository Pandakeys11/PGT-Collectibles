import { patchCatalogCardPricesJson } from "@/lib/catalog/db-catalog";
import { priceSnapshotToPricesJson } from "@/lib/catalog/catalog-price-snapshot";
import type { CatalogCardSummary } from "@/lib/catalog/catalog-types";
import { priceChartingAdapter } from "@/lib/market/adapters/pricecharting";
import { collectGradedLanes } from "@/lib/market/collect-premium-grade-lanes";
import { getPriceChartingApiToken } from "@/lib/market/env-market";
import { catalogSummaryToExtractedCard } from "@/lib/market/pokemon-market-knowledge";
import { persistMarketComps } from "@/lib/pgt-registry/pgt-market-intel-persist";
import type { CatalogPriceSnapshot } from "@/lib/market/pokemon-catalog";
import type { ExtractedCard, MarketEvidence } from "@/lib/scan/schemas";

export type Psa10HarvestResult = {
  catalogId: string;
  priceChartingRows: number;
  ebayRows: number;
  totalRows: number;
  psa10GuideUsd: number | null;
  persisted: boolean;
};

function psa10GradedCard(catalogCard: CatalogCardSummary): ExtractedCard {
  return catalogSummaryToExtractedCard(catalogCard, {
    gradeCard: { grader: "PSA", grade: "10" } as ExtractedCard,
  });
}

function tagPsa10Reference(row: MarketEvidence): MarketEvidence {
  return {
    ...row,
    kind: row.kind === "sold" || row.kind === "active" ? row.kind : "reference",
    slab: row.slab ?? "PSA 10",
    gradeBucket: "psa10",
    title: /psa\s*10|gem\s*mint/i.test(row.title) ? row.title : `${row.title} · PSA 10`,
  };
}

function pickPriceChartingPsa10Usd(rows: MarketEvidence[]): number | null {
  const ref = rows.find((r) => r.source === "PriceCharting" && r.priceUsd != null);
  return ref?.priceUsd != null ? Math.round(ref.priceUsd) : null;
}

async function harvestPriceChartingPsa10(card: ExtractedCard): Promise<MarketEvidence[]> {
  if (!getPriceChartingApiToken()) return [];
  const result = await priceChartingAdapter.collect(card);
  return result.evidence
    .filter((row) => row.priceUsd != null && /graded/i.test(row.title))
    .map(tagPsa10Reference);
}

async function harvestEbayPsa10(card: ExtractedCard): Promise<MarketEvidence[]> {
  const lanes = await collectGradedLanes(card, [], {
    buckets: ["psa10"],
    minRows: 0,
  });
  return lanes.map(tagPsa10Reference);
}

export async function harvestPsa10EvidenceForCard(
  catalogCard: CatalogCardSummary,
  options?: {
    skipPriceCharting?: boolean;
    skipEbay?: boolean;
  },
): Promise<MarketEvidence[]> {
  const graded = psa10GradedCard(catalogCard);
  const out: MarketEvidence[] = [];

  if (!options?.skipPriceCharting) {
    out.push(...(await harvestPriceChartingPsa10(graded)));
  }
  if (!options?.skipEbay) {
    out.push(...(await harvestEbayPsa10(graded)));
  }

  const seen = new Set<string>();
  return out.filter((row) => {
    const key = `${row.kind}|${row.gradeBucket}|${row.url ?? ""}|${row.title}|${row.priceUsd ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mergePsa10IntoSnapshot(
  snap: CatalogPriceSnapshot,
  psa10GuideUsd: number | null,
  psa10Url: string | null,
): CatalogPriceSnapshot {
  return {
    ...snap,
    priceChartingPsa10Usd: psa10GuideUsd ?? snap.priceChartingPsa10Usd ?? null,
    priceChartingPsa10Url: psa10Url ?? snap.priceChartingPsa10Url ?? null,
    priceChartingPsa10UpdatedAt: new Date().toISOString().slice(0, 10),
  };
}

export async function persistPsa10Harvest(
  catalogCard: CatalogCardSummary,
  evidence: MarketEvidence[],
): Promise<Psa10HarvestResult> {
  const id = catalogCard.id.trim();
  const empty: Psa10HarvestResult = {
    catalogId: id,
    priceChartingRows: 0,
    ebayRows: 0,
    totalRows: 0,
    psa10GuideUsd: null,
    persisted: false,
  };
  if (!id) return empty;

  const pcRows = evidence.filter((e) => e.source === "PriceCharting");
  const ebayRows = evidence.filter((e) => /ebay/i.test(e.source ?? ""));
  const psa10GuideUsd = pickPriceChartingPsa10Usd(pcRows);
  const psa10Url = pcRows.find((r) => r.url)?.url ?? null;

  if (evidence.length) {
    await persistMarketComps({
      catalogId: id,
      card: psa10GradedCard(catalogCard),
      marketEvidence: evidence,
    });
  }

  const snap = catalogCard.prices ?? {
    tcgPlayerUrl: null,
    tcgPlayerUpdatedAt: null,
    tcgPlayerPrices: [],
    cardMarketUrl: null,
    cardMarketUpdatedAt: null,
    cardMarket: null,
  };
  const merged = mergePsa10IntoSnapshot(snap, psa10GuideUsd, psa10Url);

  await patchCatalogCardPricesJson(
    "pokemon",
    id,
    priceSnapshotToPricesJson(merged) as unknown as Record<string, unknown>,
  );

  return {
    catalogId: id,
    priceChartingRows: pcRows.length,
    ebayRows: ebayRows.length,
    totalRows: evidence.length,
    psa10GuideUsd,
    persisted: evidence.length > 0,
  };
}

export async function processPsa10CatalogCard(
  catalogCard: CatalogCardSummary,
  options?: {
    skipPriceCharting?: boolean;
    skipEbay?: boolean;
  },
): Promise<Psa10HarvestResult> {
  const evidence = await harvestPsa10EvidenceForCard(catalogCard, options);
  return persistPsa10Harvest(catalogCard, evidence);
}
