import {
  cardmarketMomentumPct7dVs30d,
  eurToUsd,
  type CardMarketPriceFields,
} from "@/lib/market/cardmarket-eur";
import type { CatalogPriceSnapshot } from "@/lib/market/pokemon-catalog";
import type { PgtUsTrendLane } from "@/lib/market/pgt-us-trends/types";
import { getPokeTraceRealtimeUpdate } from "@/lib/market/poketrace/realtime-store";
import type { PokeTracePriceSource } from "@/lib/market/poketrace/types";

export type CatalogMomentumRegion = "us" | "eu";

export type CatalogMomentumResult = {
  pct: number | null;
  region: CatalogMomentumRegion | null;
  /** Short UI label, e.g. "US · TCGPlayer 7d vs 30d" */
  label: string;
  deltaUsd: number | null;
  window7dUsd: number | null;
  window30dUsd: number | null;
};

export const CATALOG_MOMENTUM_TITLE = "PGT US market trends";

/** One-line subtitle under section headers. */
export const CATALOG_MOMENTUM_SUBTITLE =
  "7-day vs 30-day median (USD) · PGT comps & TCG anchors · list from TCGPlayer";

/** Footer / empty-state helper — plain language for collectors. */
export const CATALOG_MOMENTUM_EXPLAINER =
  "Percent is how the last 7-day median compares to the 30-day median. " +
  "US trends use PGT sold comps and daily TCGPlayer ticks first; PokeTrace or JustTCG fill gaps when configured. " +
  "EU uses Cardmarket 7d/30d from catalog or the Pokémon TCG API.";

export function momentumSourceShort(label: string | null | undefined): string | null {
  if (!label?.trim()) return null;
  if (/^US ·/i.test(label)) return "US";
  if (/^EU ·/i.test(label)) return "EU";
  return null;
}

export function momentumPct7dVs30d(short: number, long: number): number | null {
  if (!Number.isFinite(short) || !Number.isFinite(long) || long <= 0) return null;
  return Math.round(((short - long) / long) * 1000) / 10;
}

function usSourceLabel(source: PokeTracePriceSource): string {
  return source === "ebay" ? "eBay" : "TCGPlayer";
}

function resultFromWindows(args: {
  pct: number;
  region: CatalogMomentumRegion;
  sourceLabel: string;
  window7dUsd: number;
  window30dUsd: number;
}): CatalogMomentumResult {
  return {
    pct: args.pct,
    region: args.region,
    label: args.sourceLabel,
    deltaUsd: Math.round((args.window7dUsd - args.window30dUsd) * 100) / 100,
    window7dUsd: args.window7dUsd,
    window30dUsd: args.window30dUsd,
  };
}

function isUsPokeTraceSource(
  source: string | null | undefined,
): source is PokeTracePriceSource {
  return source === "tcgplayer" || source === "ebay";
}

function fromPokeTraceMeta(
  meta: NonNullable<CatalogPriceSnapshot["pokeTrace"]>,
): CatalogMomentumResult | null {
  if (meta.momentumPct == null) return null;
  const source = meta.primarySource;
  if (!isUsPokeTraceSource(source)) return null;

  const w7 = meta.median7dUsd;
  const w30 = meta.median30dUsd;
  if (w7 != null && w30 != null && w30 > 0) {
    return resultFromWindows({
      pct: meta.momentumPct,
      region: "us",
      sourceLabel: `US · ${usSourceLabel(source)} 7d vs 30d`,
      window7dUsd: w7,
      window30dUsd: w30,
    });
  }

  return {
    pct: meta.momentumPct,
    region: "us",
    label: `US · ${usSourceLabel(source)} 7d vs 30d`,
    deltaUsd: null,
    window7dUsd: w7,
    window30dUsd: w30,
  };
}

function pgtUsLaneLabel(lane: PgtUsTrendLane): string {
  switch (lane) {
    case "sold_comps":
      return "PGT sold comps";
    case "price_ticks":
      return "PGT price history";
    case "blended":
      return "PGT blended";
    case "tcg_anchor":
      return "PGT TCG anchor";
    default:
      return "PGT US";
  }
}

function fromPgtUsMeta(
  meta: NonNullable<CatalogPriceSnapshot["pgtUs"]>,
): CatalogMomentumResult | null {
  if (meta.momentumPct == null) return null;
  const w7 = meta.median7dUsd;
  const w30 = meta.median30dUsd;
  const sourceLabel = `US · ${pgtUsLaneLabel(meta.lane)} 7d vs 30d`;
  if (w7 != null && w30 != null && w30 > 0) {
    return resultFromWindows({
      pct: meta.momentumPct,
      region: "us",
      sourceLabel,
      window7dUsd: w7,
      window30dUsd: w30,
    });
  }
  return {
    pct: meta.momentumPct,
    region: "us",
    label: sourceLabel,
    deltaUsd: null,
    window7dUsd: w7,
    window30dUsd: w30,
  };
}

function fromJustTcgMeta(
  meta: NonNullable<CatalogPriceSnapshot["justTcg"]>,
): CatalogMomentumResult | null {
  if (meta.momentumPct == null) return null;
  const w7 = meta.avgPrice7dUsd;
  const w30 = meta.avgPrice30dUsd;
  if (w7 != null && w30 != null && w30 > 0) {
    return resultFromWindows({
      pct: meta.momentumPct,
      region: "us",
      sourceLabel: "US · JustTCG 7d vs 30d",
      window7dUsd: w7,
      window30dUsd: w30,
    });
  }
  return {
    pct: meta.momentumPct,
    region: "us",
    label: "US · JustTCG 7d trend",
    deltaUsd: null,
    window7dUsd: w7,
    window30dUsd: w30,
  };
}

function fromCardmarketEu(cm: CardMarketPriceFields): CatalogMomentumResult | null {
  const pct = cardmarketMomentumPct7dVs30d(cm);
  if (pct == null || cm.avg7 == null || cm.avg30 == null) return null;
  const window7dUsd = eurToUsd(cm.avg7);
  const window30dUsd = eurToUsd(cm.avg30);
  return resultFromWindows({
    pct,
    region: "eu",
    sourceLabel: "EU · Cardmarket 7d vs 30d",
    window7dUsd,
    window30dUsd,
  });
}

const EMPTY: CatalogMomentumResult = {
  pct: null,
  region: null,
  label: "—",
  deltaUsd: null,
  window7dUsd: null,
  window30dUsd: null,
};

/**
 * Uniform catalog momentum: PGT US → PokeTrace US → JustTCG US → EU Cardmarket 7d vs 30d.
 */
export function resolveCatalogMomentum(prices: CatalogPriceSnapshot): CatalogMomentumResult {
  const pgt = prices.pgtUs;
  if (pgt) {
    const fromPgt = fromPgtUsMeta(pgt);
    if (fromPgt) return fromPgt;
  }

  const pokeId = prices.pokeTrace?.cardId?.trim();
  if (pokeId) {
    for (const source of ["tcgplayer", "ebay"] as const) {
      const live = getPokeTraceRealtimeUpdate(pokeId, { source });
      if (live?.trendPct != null && Number.isFinite(live.trendPct)) {
        return {
          pct: live.trendPct,
          region: "us",
          label: `US · ${usSourceLabel(source)} live`,
          deltaUsd: null,
          window7dUsd: live.priceUsd,
          window30dUsd: null,
        };
      }
    }
  }

  const meta = prices.pokeTrace;
  if (meta) {
    const fromMeta = fromPokeTraceMeta(meta);
    if (fromMeta) return fromMeta;
  }

  const jt = prices.justTcg;
  if (jt) {
    const fromJt = fromJustTcgMeta(jt);
    if (fromJt) return fromJt;
  }

  const cm = prices.cardMarket;
  if (cm) {
    const eu = fromCardmarketEu(cm);
    if (eu) return eu;
  }

  return EMPTY;
}

/** Single % for movers, chips, and sort — null when no 7d/30d signal. */
export function resolvedCatalogMomentumPct(prices: CatalogPriceSnapshot): number | null {
  return resolveCatalogMomentum(prices).pct;
}

export function isUsCatalogMomentum(prices: CatalogPriceSnapshot): boolean {
  return resolveCatalogMomentum(prices).region === "us";
}
