import type { ScanSpecimen } from "@/hooks/use-scan-session";
import type { CatalogPriceSnapshot } from "@/lib/market/pokemon-catalog";
import {
  buildCatalogLaneCompSummaries,
  type CatalogLaneCompSummary,
} from "@/lib/market/catalog-knowledge-lane-summary";
import {
  resolvePriceChartingGradedTiers,
  type CatalogGradedGuideTier,
} from "@/lib/market/catalog-graded-guide";
import type { FmvHeadline } from "@/lib/market/fmv-display";
import { buildFmvHeadlineFromScanFmv } from "@/lib/market/fmv-display";
import type { MarketSourceLink } from "@/lib/market/sources";
import type { CatalogMarketSnapshot } from "@/lib/pokedex/catalog-market-snapshot";
import { resolveCardListFmv } from "@/lib/scan/card-list-fmv";
import {
  catalogMarketReady,
  formatCatalogCompListed,
  formatCatalogCompPsa10Sold,
  formatCatalogCompRawSold,
  formatCatalogFmvHero,
  summarizeCatalogSources,
} from "@/lib/scan/catalog-market-present";
import { assessFmvReadiness } from "@/lib/scan/fmv-readiness";
import {
  formatCompChipListed,
  formatCompChipPsa10Sold,
  formatCompChipRawSold,
  marketDataReady,
  summarizeSources,
  type SourceSummary,
} from "@/lib/scan/sheet-present";

export type ScanCompChips = {
  rawSold: string;
  psa10Sold: string;
  listed: string;
};

export type ScanMarketPresentation = {
  readiness: ReturnType<typeof assessFmvReadiness>;
  headline: FmvHeadline;
  lanes: CatalogLaneCompSummary[];
  compChips: ScanCompChips;
  sources: SourceSummary[];
  dataSource: "Session + index" | "Scan session" | "Catalog index" | null;
  ready: boolean;
  scanReady: boolean;
  indexReady: boolean;
  priceChartingTiers: CatalogGradedGuideTier[];
};

export function buildScanCompChips(
  specimen: ScanSpecimen,
  options?: {
    snapshot?: CatalogMarketSnapshot | null;
    scanReady?: boolean;
    indexReady?: boolean;
    ready?: boolean;
  },
): ScanCompChips {
  const scanReady = options?.scanReady ?? marketDataReady(specimen);
  const snapshot = options?.snapshot ?? null;
  const indexReady = options?.indexReady ?? catalogMarketReady(snapshot);
  const ready = options?.ready ?? (scanReady || indexReady);

  if (!ready) {
    return { rawSold: "—", psa10Sold: "—", listed: "—" };
  }

  return {
    rawSold: scanReady
      ? formatCompChipRawSold(specimen)
      : indexReady && snapshot
        ? formatCatalogCompRawSold(snapshot)
        : "—",
    psa10Sold: scanReady
      ? formatCompChipPsa10Sold(specimen)
      : indexReady && snapshot
        ? formatCatalogCompPsa10Sold(snapshot)
        : "—",
    listed: scanReady
      ? formatCompChipListed(specimen)
      : indexReady && snapshot
        ? formatCatalogCompListed(snapshot)
        : "—",
  };
}

/** Unified FMV headline + lane comps for Liquid Scan surfaces (chat rows, evidence rail, market hub). */
export function buildScanMarketPresentation(
  specimen: ScanSpecimen,
  options?: {
    snapshot?: CatalogMarketSnapshot | null;
    marketSourceLinks?: MarketSourceLink[];
    pricesInput?: CatalogPriceSnapshot | Record<string, unknown> | null;
  },
): ScanMarketPresentation {
  const readiness = assessFmvReadiness(specimen);
  const fmv = resolveCardListFmv(specimen);
  const snapshot = options?.snapshot ?? null;
  const scanReady = marketDataReady(specimen);
  const indexReady = catalogMarketReady(snapshot);
  const ready = scanReady || indexReady;

  let headline = buildFmvHeadlineFromScanFmv(fmv);

  if (!readiness.ready) {
    headline = {
      ...headline,
      amount: "—",
      amountUsd: null,
      held: true,
      holdMessage: readiness.message,
      preview: true,
      basisLabel: null,
      lanes: [],
    };
  } else if (scanReady) {
    headline = buildFmvHeadlineFromScanFmv(fmv);
  } else if (indexReady && snapshot) {
    const indexHero = formatCatalogFmvHero(snapshot);
    headline = {
      amount: indexHero.amount,
      amountUsd: snapshot.fairValueUsd,
      basisLabel: indexHero.basis,
      sourceLabel: "Catalog index",
      held: false,
      holdMessage: null,
      lanes: [],
      preview: false,
    };
  }

  const evidence =
    scanReady
      ? specimen.context.marketEvidence
      : indexReady && snapshot
        ? snapshot.marketEvidence
        : [];

  const lanes = buildCatalogLaneCompSummaries(evidence);
  const compChips = buildScanCompChips(specimen, { snapshot, scanReady, indexReady, ready });

  const sources = scanReady
    ? summarizeSources(specimen)
    : indexReady && snapshot
      ? summarizeCatalogSources(snapshot, options?.marketSourceLinks ?? [])
      : [];

  const dataSource =
    scanReady && indexReady
      ? "Session + index"
      : scanReady
        ? "Scan session"
        : indexReady
          ? "Catalog index"
          : null;

  const priceChartingTiers = options?.pricesInput
    ? resolvePriceChartingGradedTiers(options.pricesInput).filter((t) => t.usd != null)
    : [];

  return {
    readiness,
    headline,
    lanes,
    compChips,
    sources,
    dataSource,
    ready,
    scanReady,
    indexReady,
    priceChartingTiers,
  };
}

export function buildScanFmvHeadline(
  specimen: ScanSpecimen,
  options?: Parameters<typeof buildScanMarketPresentation>[1],
): FmvHeadline {
  return buildScanMarketPresentation(specimen, options).headline;
}
