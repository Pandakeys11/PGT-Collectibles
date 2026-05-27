/** Collector / vendor deal math for Liquid Scan. */

export const VENDOR_PERCENT_PRESETS = [95, 90, 85, 80, 75, 70] as const;

export type VendorPercentPreset = (typeof VENDOR_PERCENT_PRESETS)[number];

export function parseCalculatorAmount(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function formatCalculatorMoney(value: number, compact = false): string {
  if (!Number.isFinite(value)) return "$0";
  if (compact && value >= 1000) {
    return `$${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

export function applyPercentOfBase(base: number, percent: number): number {
  if (!Number.isFinite(base) || base < 0) return 0;
  return Math.max(0, (base * percent) / 100);
}

export function roundMoney(value: number, step: number): number {
  if (!Number.isFinite(value) || step <= 0) return value;
  return Math.round(value / step) * step;
}

export function marginFromBase(base: number, offer: number): {
  spread: number;
  marginPct: number | null;
} {
  const spread = base - offer;
  const marginPct = base > 0 ? (spread / base) * 100 : null;
  return { spread, marginPct };
}

export type PercentQuote = {
  percent: VendorPercentPreset;
  amount: number;
  spread: number;
};

export function buildPercentQuotes(base: number): PercentQuote[] {
  return VENDOR_PERCENT_PRESETS.map((percent) => {
    const amount = applyPercentOfBase(base, percent);
    return { percent, amount, spread: base - amount };
  });
}

/** Typical show / cash buy rates for quick vendor tools. */
export const COLLECTOR_QUICK_RATES = {
  cashOffer: 65,
  tradeValue: 78,
  storeCredit: 80,
  aggressiveBuy: 70,
  fairTrade: 85,
} as const;
