import {
  priceSnapshotToPricesJson,
  snapshotHasTcgMarketPrices,
} from "@/lib/catalog/catalog-price-snapshot";
import type { CatalogPriceSnapshot } from "@/lib/market/pokemon-catalog";
import type { JustTcgCard, JustTcgVariant } from "@/lib/market/justtcg/types";

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function extractTcgPlayerProductId(url: string | null | undefined): string | null {
  const raw = url?.trim();
  if (!raw) return null;
  const m = raw.match(/\/product\/(\d+)/i);
  return m?.[1] ?? null;
}

function variantKey(variant: JustTcgVariant): string {
  const printing = (variant.printing ?? "Normal").replace(/\s+/g, "");
  const condition = (variant.condition ?? "Near Mint").replace(/\s+/g, "_");
  return `${printing}_${condition}`.replace(/[^a-zA-Z0-9_]+/g, "");
}

function variantUpdatedAt(variant: JustTcgVariant): string | null {
  const raw = variant.lastUpdatedAt ?? variant.lastUpdated;
  if (!raw?.trim()) return null;
  return raw.slice(0, 10);
}

function variantPrices(variant: JustTcgVariant) {
  const market = asNumber(variant.price) ?? asNumber(variant.avg);
  return {
    variant: variantKey(variant),
    market,
    mid: market,
    low: asNumber(variant.low),
    high: asNumber(variant.high),
    directLow: null,
  };
}

/** Map JustTCG card payload → uniform catalog price snapshot. */
export function priceSnapshotFromJustTcgCard(
  card: JustTcgCard,
  existing?: CatalogPriceSnapshot | null,
): CatalogPriceSnapshot {
  const base = existing ?? {
    tcgPlayerUrl: null,
    tcgPlayerUpdatedAt: null,
    tcgPlayerPrices: [],
    cardMarketUrl: null,
    cardMarketUpdatedAt: null,
    cardMarket: null,
  };

  const tcgId = card.tcgplayerId != null ? String(card.tcgplayerId).trim() : null;
  const tcgPlayerUrl =
    base.tcgPlayerUrl ??
    (tcgId ? `https://www.tcgplayer.com/product/${tcgId}` : null);

  const variantRows = (card.variants ?? [])
    .map(variantPrices)
    .filter((row) => row.market != null || row.low != null || row.high != null);

  const latestVariantDate = (card.variants ?? [])
    .map(variantUpdatedAt)
    .filter((d): d is string => Boolean(d))
    .sort()
    .at(-1);

  return {
    ...base,
    tcgPlayerUrl,
    tcgPlayerUpdatedAt: latestVariantDate ?? new Date().toISOString().slice(0, 10),
    tcgPlayerPrices: variantRows.length ? variantRows : base.tcgPlayerPrices,
  };
}

export function mergeJustTcgIntoPricesJson(
  card: JustTcgCard,
  existingPricesJson: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const existing = existingPricesJson ?? {};
  const prior: CatalogPriceSnapshot = {
    tcgPlayerUrl: typeof existing.tcgPlayerUrl === "string" ? existing.tcgPlayerUrl : null,
    tcgPlayerUpdatedAt:
      typeof existing.tcgPlayerUpdatedAt === "string" ? existing.tcgPlayerUpdatedAt : null,
    tcgPlayerPrices: Array.isArray(existing.tcgPlayerPrices)
      ? (existing.tcgPlayerPrices as CatalogPriceSnapshot["tcgPlayerPrices"])
      : [],
    cardMarketUrl: typeof existing.cardMarketUrl === "string" ? existing.cardMarketUrl : null,
    cardMarketUpdatedAt:
      typeof existing.cardMarketUpdatedAt === "string" ? existing.cardMarketUpdatedAt : null,
    cardMarket:
      existing.cardMarket && typeof existing.cardMarket === "object"
        ? (existing.cardMarket as CatalogPriceSnapshot["cardMarket"])
        : null,
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

export function justTcgCardHasPrices(card: JustTcgCard | null | undefined): boolean {
  if (!card?.variants?.length) return false;
  const snap = priceSnapshotFromJustTcgCard(card);
  return snapshotHasTcgMarketPrices(snap);
}

export function matchJustTcgCardToRow(
  row: { name: string; card_number?: string | null; prices_json?: Record<string, unknown> | null },
  candidates: JustTcgCard[],
): JustTcgCard | null {
  if (!candidates.length) return null;

  const tcgId = extractTcgPlayerProductId(
    typeof row.prices_json?.tcgPlayerUrl === "string" ? row.prices_json.tcgPlayerUrl : null,
  );
  if (tcgId) {
    const byId = candidates.find((c) => String(c.tcgplayerId ?? "") === tcgId);
    if (byId) return byId;
  }

  const num = String(row.card_number ?? "")
    .replace(/^#/, "")
    .trim();
  const name = row.name.trim().toLowerCase();

  const ranked = candidates
    .map((c) => {
      let score = 0;
      const cName = c.name.trim().toLowerCase();
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

export function batchLookupItemForRow(
  row: {
    name: string;
    set_code?: string | null;
    set_name?: string | null;
    card_number?: string | null;
    prices_json?: Record<string, unknown> | null;
  },
  game: string,
): { key: string; item: import("@/lib/market/justtcg/types").JustTcgBatchLookupItem } {
  const storedId =
    row.prices_json?.justTcg &&
    typeof row.prices_json.justTcg === "object" &&
    typeof (row.prices_json.justTcg as Record<string, unknown>).tcgplayerId === "string"
      ? String((row.prices_json.justTcg as Record<string, unknown>).tcgplayerId)
      : null;

  const tcgplayerId =
    storedId ??
    extractTcgPlayerProductId(
      typeof row.prices_json?.tcgPlayerUrl === "string" ? row.prices_json.tcgPlayerUrl : null,
    );

  if (tcgplayerId) {
    return { key: `id:${tcgplayerId}`, item: { tcgplayerId } };
  }

  const set = String(row.set_code ?? row.set_name ?? "").trim();
  const number = String(row.card_number ?? "")
    .replace(/^#/, "")
    .trim();
  const query = row.name.trim().slice(0, 80);
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
