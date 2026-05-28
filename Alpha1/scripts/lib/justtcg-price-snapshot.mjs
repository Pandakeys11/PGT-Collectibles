/**
 * JustTCG → prices_json — mirrors src/lib/market/justtcg/price-snapshot.ts
 */

import { priceSnapshotToPricesJson, snapshotHasTcgMarketPrices } from "./catalog-price-snapshot.mjs";

export const JUSTTCG_FRANCHISES = ["magic", "yugioh", "lorcana", "onepiece"];

const GAME_BY_FRANCHISE = {
  magic: "Magic: The Gathering",
  yugioh: "Yu-Gi-Oh!",
  lorcana: "Disney Lorcana",
  onepiece: "One Piece TCG",
};

export function justTcgGameForFranchise(franchise) {
  return GAME_BY_FRANCHISE[franchise] ?? null;
}

export function extractTcgPlayerProductId(url) {
  const raw = url?.trim();
  if (!raw) return null;
  const m = raw.match(/\/product\/(\d+)/i);
  return m?.[1] ?? null;
}

function variantKey(variant) {
  const printing = (variant.printing ?? "Normal").replace(/\s+/g, "");
  const condition = (variant.condition ?? "Near Mint").replace(/\s+/g, "_");
  return `${printing}_${condition}`.replace(/[^a-zA-Z0-9_]+/g, "");
}

function variantPrices(variant) {
  const market =
    typeof variant.price === "number"
      ? variant.price
      : typeof variant.avg === "number"
        ? variant.avg
        : null;
  return {
    variant: variantKey(variant),
    market,
    mid: market,
    low: typeof variant.low === "number" ? variant.low : null,
    high: typeof variant.high === "number" ? variant.high : null,
    directLow: null,
  };
}

export function priceSnapshotFromJustTcgCard(card, existing) {
  const base = existing ?? {
    tcgPlayerUrl: null,
    tcgPlayerUpdatedAt: null,
    tcgPlayerPrices: [],
    cardMarketUrl: null,
    cardMarketUpdatedAt: null,
    cardMarket: null,
  };

  const tcgId = card.tcgplayerId != null ? String(card.tcgplayerId).trim() : null;
  const tcgPlayerUrl = base.tcgPlayerUrl ?? (tcgId ? `https://www.tcgplayer.com/product/${tcgId}` : null);

  const variantRows = (card.variants ?? [])
    .map(variantPrices)
    .filter((row) => row.market != null || row.low != null || row.high != null);

  const latestVariantDate = (card.variants ?? [])
    .map((v) => (v.lastUpdatedAt ?? v.lastUpdated)?.slice?.(0, 10))
    .filter(Boolean)
    .sort()
    .at(-1);

  return {
    ...base,
    tcgPlayerUrl,
    tcgPlayerUpdatedAt: latestVariantDate ?? new Date().toISOString().slice(0, 10),
    tcgPlayerPrices: variantRows.length ? variantRows : base.tcgPlayerPrices,
  };
}

export function mergeJustTcgIntoPricesJson(card, existingPricesJson) {
  const existing = existingPricesJson ?? {};
  const prior = {
    tcgPlayerUrl: typeof existing.tcgPlayerUrl === "string" ? existing.tcgPlayerUrl : null,
    tcgPlayerUpdatedAt:
      typeof existing.tcgPlayerUpdatedAt === "string" ? existing.tcgPlayerUpdatedAt : null,
    tcgPlayerPrices: Array.isArray(existing.tcgPlayerPrices) ? existing.tcgPlayerPrices : [],
    cardMarketUrl: typeof existing.cardMarketUrl === "string" ? existing.cardMarketUrl : null,
    cardMarketUpdatedAt:
      typeof existing.cardMarketUpdatedAt === "string" ? existing.cardMarketUpdatedAt : null,
    cardMarket:
      existing.cardMarket && typeof existing.cardMarket === "object" ? existing.cardMarket : null,
  };

  const merged = priceSnapshotFromJustTcgCard(card, prior);
  const out = priceSnapshotToPricesJson(merged);
  out.justTcg = {
    cardId: card.id,
    syncedAt: new Date().toISOString(),
    game: card.game ?? null,
    tcgplayerId: card.tcgplayerId != null ? String(card.tcgplayerId) : null,
  };
  return out;
}

export function justTcgCardHasPrices(card) {
  if (!card?.variants?.length) return false;
  return snapshotHasTcgMarketPrices(priceSnapshotFromJustTcgCard(card));
}

export function matchJustTcgCardToRow(row, candidates) {
  if (!candidates?.length) return null;

  const tcgId = extractTcgPlayerProductId(row.prices_json?.tcgPlayerUrl);
  if (tcgId) {
    const byId = candidates.find((c) => String(c.tcgplayerId ?? "") === tcgId);
    if (byId) return byId;
  }

  const num = String(row.card_number ?? "")
    .replace(/^#/, "")
    .trim();
  const name = String(row.name ?? "")
    .trim()
    .toLowerCase();

  const ranked = candidates
    .map((c) => {
      let score = 0;
      const cName = String(c.name ?? "")
        .trim()
        .toLowerCase();
      if (cName === name || cName.includes(name) || name.includes(cName)) score += 4;
      const cNum = String(c.number ?? "")
        .replace(/^#/, "")
        .trim();
      if (num && cNum && num === cNum) score += 5;
      return { c, score };
    })
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.score >= 4 ? ranked[0].c : candidates[0] ?? null;
}

export function batchLookupItemForRow(row, game) {
  const storedId =
    row.prices_json?.justTcg &&
    typeof row.prices_json.justTcg === "object" &&
    typeof row.prices_json.justTcg.tcgplayerId === "string"
      ? row.prices_json.justTcg.tcgplayerId
      : null;

  const tcgplayerId = storedId ?? extractTcgPlayerProductId(row.prices_json?.tcgPlayerUrl);
  if (tcgplayerId) {
    return { key: `id:${tcgplayerId}`, item: { tcgplayerId } };
  }

  const set = String(row.set_code ?? row.set_name ?? "").trim();
  const number = String(row.card_number ?? "")
    .replace(/^#/, "")
    .trim();
  const query = String(row.name ?? "").trim().slice(0, 80);
  const key = `q:${game}|${set}|${number}|${query.toLowerCase()}`;
  return {
    key,
    item: {
      game,
      set: set || undefined,
      number: number || undefined,
      query,
    },
  };
}

export function dbRowHasJustTcgPrices(pricesJson) {
  return snapshotHasTcgMarketPrices({
    tcgPlayerPrices: pricesJson?.tcgPlayerPrices ?? [],
  });
}
