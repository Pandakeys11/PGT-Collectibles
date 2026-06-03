import { momentumPct7dVs30d } from "@/lib/market/catalog-momentum";
import { median } from "@/lib/market/fair-value";
import type { PgtUsTrendLane, PgtUsTrendMeta, PgtUsTrendResult } from "@/lib/market/pgt-us-trends/types";

export type PgtUsPricePoint = {
  priceUsd: number;
  observedAt: string | null;
  kind: "sold" | "active" | "reference";
  source?: string | null;
};

const MIN_COMPS_7D = 2;
const MIN_COMPS_30D = 3;
const MIN_TICKS_7D = 2;
const MIN_TICKS_30D = 4;

function parseYmd(value: string | null | undefined): Date | null {
  if (!value?.trim()) return null;
  const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function daysAgoUtc(n: number): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - n));
}

function isUsComp(point: PgtUsPricePoint): boolean {
  if (point.kind === "sold") return true;
  const src = (point.source ?? "").toLowerCase();
  return src.includes("tcgplayer") || src.includes("ebay") || src.includes("pricecharting");
}

function pricesInWindow(
  points: PgtUsPricePoint[],
  startInclusive: Date,
  endExclusive: Date,
): number[] {
  const out: number[] = [];
  for (const p of points) {
    if (!isUsComp(p)) continue;
    const d = parseYmd(p.observedAt);
    if (!d || d < startInclusive || d >= endExclusive) continue;
    if (Number.isFinite(p.priceUsd) && p.priceUsd > 0) out.push(p.priceUsd);
  }
  return out;
}

function pricesFromTicks(
  ticks: Array<{ priceUsd: number; capturedOn: string }>,
  startInclusive: Date,
  endExclusive: Date,
): number[] {
  const out: number[] = [];
  for (const t of ticks) {
    const d = parseYmd(t.capturedOn);
    if (!d || d < startInclusive || d >= endExclusive) continue;
    if (Number.isFinite(t.priceUsd) && t.priceUsd > 0) out.push(t.priceUsd);
  }
  return out;
}

function buildResult(args: {
  w7: number;
  w30: number;
  lane: PgtUsTrendLane;
  comps7d: number;
  comps30d: number;
}): PgtUsTrendResult | null {
  const pct = momentumPct7dVs30d(args.w7, args.w30);
  if (pct == null) return null;
  const meta: PgtUsTrendMeta = {
    momentumPct: pct,
    median7dUsd: Math.round(args.w7 * 100) / 100,
    median30dUsd: Math.round(args.w30 * 100) / 100,
    lane: args.lane,
    comps7d: args.comps7d,
    comps30d: args.comps30d,
    syncedAt: new Date().toISOString(),
  };
  return {
    meta,
    pct,
    window7dUsd: meta.median7dUsd!,
    window30dUsd: meta.median30dUsd!,
  };
}

/**
 * US trend from institutional comps: median last 7d vs median last 30d (UTC).
 */
export function computePgtUsTrendFromComps(
  comps: PgtUsPricePoint[],
): PgtUsTrendResult | null {
  const end = daysAgoUtc(0);
  const start7 = daysAgoUtc(7);
  const start30 = daysAgoUtc(30);

  const p7 = pricesInWindow(comps, start7, end);
  const p30 = pricesInWindow(comps, start30, end);
  const m7 = median(p7);
  const m30 = median(p30);
  if (m7 == null || m30 == null) return null;
  if (p7.length < MIN_COMPS_7D || p30.length < MIN_COMPS_30D) return null;
  return buildResult({
    w7: m7,
    w30: m30,
    lane: "sold_comps",
    comps7d: p7.length,
    comps30d: p30.length,
  });
}

/** US trend from daily TCGPlayer ticks recorded by PGT sync. */
export function computePgtUsTrendFromTicks(
  ticks: Array<{ priceUsd: number; capturedOn: string }>,
): PgtUsTrendResult | null {
  const end = daysAgoUtc(0);
  const start7 = daysAgoUtc(7);
  const start30 = daysAgoUtc(30);

  const p7 = pricesFromTicks(ticks, start7, end);
  const p30 = pricesFromTicks(ticks, start30, end);
  const m7 = median(p7);
  const m30 = median(p30);
  if (m7 == null || m30 == null) return null;
  if (p7.length < MIN_TICKS_7D || p30.length < MIN_TICKS_30D) return null;
  return buildResult({
    w7: m7,
    w30: m30,
    lane: "price_ticks",
    comps7d: p7.length,
    comps30d: p30.length,
  });
}

/** Blend comps + ticks when both exist — comps win for 7d if stronger sample. */
export function resolvePgtUsTrend(args: {
  comps?: PgtUsPricePoint[];
  ticks?: Array<{ priceUsd: number; capturedOn: string }>;
  tcgAnchorUsd?: number | null;
}): PgtUsTrendResult | null {
  const fromComps = args.comps?.length ? computePgtUsTrendFromComps(args.comps) : null;
  const fromTicks = args.ticks?.length ? computePgtUsTrendFromTicks(args.ticks) : null;

  if (fromComps && fromTicks) {
    return {
      ...fromComps,
      meta: {
        ...fromComps.meta,
        lane: "blended",
        comps7d: fromComps.meta.comps7d + fromTicks.meta.comps7d,
        comps30d: fromComps.meta.comps30d + fromTicks.meta.comps30d,
      },
    };
  }
  if (fromComps) return fromComps;
  if (fromTicks) return fromTicks;
  return null;
}
