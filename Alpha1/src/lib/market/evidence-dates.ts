import type { MarketEvidence } from "@/lib/scan/schemas";

/** Drop observedAt when it is implausible, in the future, or older than this (default ~15 months). */
function maxEvidenceAgeMs(): number {
  const env = process.env.MARKET_MAX_EVIDENCE_AGE_DAYS?.trim();
  const days = env ? Number(env) : NaN;
  const d = Number.isFinite(days) && days > 30 ? days : 460;
  return d * 24 * 60 * 60 * 1000;
}

function parseEvidenceDate(value: string | null | undefined): number | null {
  if (!value?.trim()) return null;
  const t = new Date(value.trim()).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * Clears observedAt when it is not a credible recent sale/list date for UI display.
 * Old rows still show price/source; date becomes "date n/a" instead of misleading 2020/2021.
 */
export function sanitizeMarketEvidenceDates(item: MarketEvidence): MarketEvidence {
  const ts = parseEvidenceDate(item.observedAt);
  if (ts == null) return { ...item, observedAt: null };

  const now = Date.now();
  if (ts > now + 48 * 60 * 60 * 1000) return { ...item, observedAt: null };

  if (now - ts > maxEvidenceAgeMs()) return { ...item, observedAt: null };

  return {
    ...item,
    observedAt: new Date(ts).toISOString().slice(0, 10),
  };
}

export function sanitizeEvidenceList(items: MarketEvidence[]): MarketEvidence[] {
  return items.map(sanitizeMarketEvidenceDates);
}
