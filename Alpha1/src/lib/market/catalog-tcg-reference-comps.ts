import { eurToUsd } from "@/lib/market/cardmarket-eur";
import type { CatalogPriceSnapshot } from "@/lib/market/pokemon-catalog";
import { parseCatalogPriceSnapshot } from "@/lib/market/catalog-reference-evidence";
import { primaryTcgPlayerFromSnapshot } from "@/lib/market/catalog-raw-fmv";
import { persistMarketComps } from "@/lib/pgt-registry/pgt-market-intel-persist";
import type { ExtractedCard, MarketEvidence } from "@/lib/scan/schemas";

function observedYmd(iso: string | null | undefined): string {
  if (!iso?.trim()) return new Date().toISOString().slice(0, 10);
  const m = iso.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return m?.[1] ?? new Date().toISOString().slice(0, 10);
}

function isUsd(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0.5;
}

/** Build reference comps from TCGPlayer + Cardmarket snapshot (PGT Vision anchor lane). */
export function tcgSnapshotToMarketEvidence(args: {
  catalogId: string;
  name: string;
  number?: string | null;
  setName?: string | null;
  prices?: CatalogPriceSnapshot | null;
}): MarketEvidence[] {
  const prices = args.prices ?? parseCatalogPriceSnapshot(null);
  const observedAt = observedYmd(prices.tcgPlayerUpdatedAt ?? prices.cardMarketUpdatedAt);
  const out: MarketEvidence[] = [];

  for (const row of prices.tcgPlayerPrices) {
    const usd = row.market ?? row.mid ?? row.low;
    if (!isUsd(usd)) continue;
    const url = prices.tcgPlayerUrl?.trim();
    if (!url) continue;
    out.push({
      kind: "reference",
      title: `${args.name} · ${row.variant} · TCGPlayer market`,
      priceUsd: Math.round(usd * 100) / 100,
      observedAt,
      url,
      source: "TCGPlayer",
      slab: null,
      gradeBucket: "raw",
    });
  }

  const headline = primaryTcgPlayerFromSnapshot(prices);
  if (headline != null && prices.tcgPlayerUrl?.trim()) {
    const hasHeadline = out.some((e) => Math.abs((e.priceUsd ?? 0) - headline) < 0.01);
    if (!hasHeadline) {
      out.unshift({
        kind: "reference",
        title: `${args.name} · TCGPlayer market`,
        priceUsd: Math.round(headline),
        observedAt,
        url: prices.tcgPlayerUrl.trim(),
        source: "TCGPlayer",
        slab: null,
        gradeBucket: "raw",
      });
    }
  }

  const cm = prices.cardMarket;
  if (cm?.trendPrice != null && isUsd(cm.trendPrice) && prices.cardMarketUrl?.trim()) {
    out.push({
      kind: "reference",
      title: `${args.name} · Cardmarket trend (EUR→USD)`,
      priceUsd: eurToUsd(cm.trendPrice),
      observedAt: observedYmd(prices.cardMarketUpdatedAt),
      url: prices.cardMarketUrl.trim(),
      source: "Cardmarket",
      slab: null,
      gradeBucket: "raw",
    });
  }

  return out.slice(0, 12);
}

function toExtractedCard(args: {
  name: string;
  number?: string | null;
  setName?: string | null;
}): ExtractedCard {
  return {
    name: args.name,
    set: args.setName ?? undefined,
    number: args.number ?? undefined,
  };
}

/** Upsert TCGPlayer/Cardmarket reference rows into `pgt_market_comps` for catalog FMV. */
export async function persistTcgReferenceCompsForCatalogCard(args: {
  catalogId: string;
  name: string;
  number?: string | null;
  setName?: string | null;
  prices?: CatalogPriceSnapshot | null;
}): Promise<number> {
  const evidence = tcgSnapshotToMarketEvidence(args);
  if (!evidence.length) return 0;
  await persistMarketComps({
    catalogId: args.catalogId,
    card: toExtractedCard(args),
    marketEvidence: evidence,
  });
  return evidence.length;
}
