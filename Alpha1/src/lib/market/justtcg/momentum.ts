import { momentumPct7dVs30d } from "@/lib/market/catalog-momentum";
import type { JustTcgCatalogMeta } from "@/lib/market/pokemon-catalog";
import type { JustTcgCard, JustTcgVariant } from "@/lib/market/justtcg/types";

const PREFERRED_CONDITIONS = [
  /^near\s*mint$/i,
  /^lightly\s*played$/i,
  /^mint$/i,
  /^nm$/i,
];

function variantScore(v: JustTcgVariant): number {
  const cond = (v.condition ?? "").trim();
  let score = 0;
  for (let i = 0; i < PREFERRED_CONDITIONS.length; i++) {
    if (PREFERRED_CONDITIONS[i].test(cond)) score += 10 - i;
  }
  if (/^normal$/i.test(v.printing ?? "")) score += 2;
  if (v.price != null && v.price > 0) score += 1;
  const mom = justTcgVariantMomentumPct(v);
  if (mom != null && mom !== 0) score += 3;
  return score;
}

export function pickJustTcgVariant(card: JustTcgCard): JustTcgVariant | null {
  const variants = card.variants ?? [];
  if (!variants.length) return null;
  return [...variants].sort((a, b) => variantScore(b) - variantScore(a))[0] ?? null;
}

/** 7d vs 30d window % — prefers avgPrice vs avgPrice30d, else priceChange7d. */
export function justTcgVariantMomentumPct(variant: JustTcgVariant): number | null {
  const w30 = variant.avgPrice30d;
  const w7 = variant.avgPrice;
  if (w7 != null && w30 != null && w30 > 0) {
    return momentumPct7dVs30d(w7, w30);
  }
  const ch7 = variant.priceChange7d;
  if (ch7 != null && Number.isFinite(ch7) && ch7 !== 0) {
    return Math.round(ch7 * 10) / 10;
  }
  return null;
}

export function justTcgCatalogMetaFromCard(card: JustTcgCard): JustTcgCatalogMeta | null {
  const variant = pickJustTcgVariant(card);
  if (!variant) return null;
  const momentumPct = justTcgVariantMomentumPct(variant);
  if (momentumPct == null) return null;

  return {
    cardId: card.id,
    syncedAt: new Date().toISOString(),
    tcgplayerId: card.tcgplayerId != null ? String(card.tcgplayerId) : null,
    momentumPct,
    avgPrice7dUsd: variant.avgPrice ?? null,
    avgPrice30dUsd: variant.avgPrice30d ?? null,
    priceUsd: variant.price ?? null,
  };
}
