import type { SlabzRarity } from "@/lib/slabz/types";

export function formatSlabzTokenAmount(amount: number | null | undefined, symbol: string): string {
  if (amount == null || !Number.isFinite(amount)) return "—";
  const digits = amount >= 100 ? 2 : amount >= 1 ? 2 : 4;
  return `${amount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  })} ${symbol}`;
}

export function formatSlabzUsd(cents: number | null | undefined): string {
  if (cents == null || !Number.isFinite(cents)) return "—";
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function shortSolanaAddress(addr: string, head = 4, tail = 4): string {
  if (addr.length <= head + tail + 2) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

const RARITY_STYLES: Record<string, string> = {
  common: "text-slate-300 ring-slate-500/30 bg-slate-500/10",
  uncommon: "text-emerald-200 ring-emerald-500/35 bg-emerald-500/12",
  rare: "text-sky-200 ring-sky-500/35 bg-sky-500/12",
  epic: "text-violet-200 ring-violet-500/40 bg-violet-500/15",
  legendary: "text-amber-200 ring-amber-400/45 bg-amber-500/15",
};

export function slabzRarityClass(rarity: string | null | undefined): string {
  const key = (rarity ?? "common").toLowerCase();
  return RARITY_STYLES[key] ?? RARITY_STYLES.common;
}

export function slabzRarityLabel(rarity: SlabzRarity | string | null | undefined): string {
  if (!rarity) return "Unknown";
  return rarity.charAt(0).toUpperCase() + rarity.slice(1);
}
