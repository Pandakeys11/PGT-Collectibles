import type { CatalogCardSummary } from "@/lib/catalog/catalog-types";
import { bestCatalogUsd } from "@/lib/market/catalog-price-utils";
import {
  catalogPriceSnapshotFromCardInput,
  primaryTcgPlayerFromSnapshot,
  tcgPlayerEmbedFromSnapshot,
} from "@/lib/market/catalog-raw-fmv";
import {
  enrichCardsWithLiveTcgPrices,
  priceSnapshotFromTcgCard,
} from "@/lib/catalog/set-insight-utils";
import type { TcgCardSummary } from "@/lib/pokedex/tcg-api-types";
import {
  CATALOG_SET_PRICING_SELECT,
  fetchAllCardsForSet,
  fetchCardsByQuery,
} from "@/lib/pokedex/tcg-api-server";

export function pokemonApiCardId(card: {
  id?: string;
  sourceCatalogId?: string | null;
}): string | null {
  const fromSource = card.sourceCatalogId?.trim();
  if (fromSource) return fromSource;
  const id = card.id?.trim();
  if (id && /^[a-z0-9]{2,}-[a-z0-9]+/i.test(id)) return id;
  return null;
}

function normalizeCardKey(name: string, number: string | null | undefined): string {
  const n = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const raw = (number ?? "").replace(/^#/, "").trim();
  const primary = (raw.split("/")[0] ?? raw).replace(/^0+/, "").trim() || raw;
  return `${n}|${primary}`;
}

/** True when live TCGPlayer market should still be merged from the Pokémon TCG API. */
export function needsTcgPlayerHydration(card: TcgCardSummary): boolean {
  const prices = catalogPriceSnapshotFromCardInput({
    catalogPrices: card.catalogPrices,
    tcgplayer: card.tcgplayer,
    cardmarket: card.cardmarket,
  });
  return (
    primaryTcgPlayerFromSnapshot(prices, {
      catalogFinish: card.catalogFinish,
      rarity: card.rarity,
    }) == null
  );
}

export function tcgSummaryHasFmv(card: TcgCardSummary): boolean {
  const fromEmbed = card.tcgplayer?.prices;
  if (fromEmbed) {
    const has = Object.values(fromEmbed).some(
      (p) =>
        (typeof p?.market === "number" && Number.isFinite(p.market) && p.market >= 0.5) ||
        (typeof p?.mid === "number" && Number.isFinite(p.mid) && p.mid >= 0.5),
    );
    if (has) return true;
  }
  if (card.catalogPrices && bestCatalogUsd(card.catalogPrices) != null) return true;
  const cm = card.cardmarket?.prices;
  if (cm) {
    for (const n of [
      cm.trendPrice,
      cm.averageSellPrice,
      cm.lowPrice,
      cm.avg7,
      cm.avg30,
    ]) {
      if (typeof n === "number" && Number.isFinite(n) && n >= 0.5) return true;
    }
  }
  return false;
}

function catalogRowToSummaryWithPrices(
  row: CatalogCardSummary,
  live?: TcgCardSummary,
): TcgCardSummary {
  if (live?.tcgplayer?.prices || live?.cardmarket?.prices) {
    const snapshot = priceSnapshotFromTcgCard(live);
    return {
      id: row.id,
      name: row.name,
      number: row.number ?? "",
      rarity: row.rarity ?? undefined,
      catalogFinish: row.catalogFinish,
      catalogVariantKey: row.catalogVariantKey,
      catalogVariantLabel: row.catalogVariantLabel,
      sourceCatalogId: row.sourceCatalogId ?? live.id,
      images: row.images ?? live.images,
      catalogPrices: snapshot,
      set: row.set
        ? {
            id: row.set.id,
            name: row.set.name,
            releaseDate: row.set.releaseDate ?? undefined,
          }
        : live.set,
      tcgplayer: tcgPlayerEmbedFromSnapshot(snapshot),
      cardmarket: live.cardmarket,
    };
  }

  const snapshot = row.prices;
  if (snapshot && bestCatalogUsd(snapshot) != null) {
    return {
      id: row.id,
      name: row.name,
      number: row.number ?? "",
      rarity: row.rarity ?? undefined,
      catalogFinish: row.catalogFinish,
      catalogVariantKey: row.catalogVariantKey,
      catalogVariantLabel: row.catalogVariantLabel,
      sourceCatalogId: row.sourceCatalogId,
      images: row.images,
      catalogPrices: snapshot,
      set: row.set
        ? {
            id: row.set.id,
            name: row.set.name,
            releaseDate: row.set.releaseDate ?? undefined,
          }
        : undefined,
      tcgplayer: tcgPlayerEmbedFromSnapshot(snapshot),
      cardmarket:
        snapshot.cardMarket && snapshot.cardMarketUrl
          ? {
              url: snapshot.cardMarketUrl,
              updatedAt: snapshot.cardMarketUpdatedAt ?? undefined,
              prices: {
                trendPrice: snapshot.cardMarket.trendPrice ?? undefined,
                averageSellPrice: snapshot.cardMarket.averageSellPrice ?? undefined,
                lowPrice: snapshot.cardMarket.lowPrice ?? undefined,
                avg7: snapshot.cardMarket.avg7 ?? undefined,
                avg30: snapshot.cardMarket.avg30 ?? undefined,
                reverseHoloTrend: snapshot.cardMarket.reverseHoloTrend ?? undefined,
              },
            }
          : undefined,
    };
  }

  return {
    id: row.id,
    name: row.name,
    number: row.number ?? "",
    rarity: row.rarity ?? undefined,
    images: row.images,
    set: row.set
      ? { id: row.set.id, name: row.set.name, releaseDate: row.set.releaseDate ?? undefined }
      : undefined,
  };
}

function rowHasTcgEmbed(row: { tcgplayer?: TcgCardSummary["tcgplayer"] }): boolean {
  const prices = row.tcgplayer?.prices;
  if (!prices) return false;
  return Object.values(prices).some(
    (p) =>
      (typeof p?.market === "number" && Number.isFinite(p.market)) ||
      (typeof p?.mid === "number" && Number.isFinite(p.mid)),
  );
}

function applyLiveHit(card: TcgCardSummary, live: TcgCardSummary): TcgCardSummary {
  const snapshot = priceSnapshotFromTcgCard(live);
  return {
    ...card,
    catalogPrices: snapshot,
    tcgplayer: tcgPlayerEmbedFromSnapshot(snapshot) ?? card.tcgplayer,
    cardmarket: live.cardmarket ?? card.cardmarket,
    sourceCatalogId: card.sourceCatalogId ?? live.id,
  };
}

async function fetchLiveByPokemonIds(ids: string[]): Promise<TcgCardSummary[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return [];

  const out: TcgCardSummary[] = [];
  const chunkSize = 15;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const batch = unique.slice(i, i + chunkSize);
    const q = batch.map((id) => `id:${id}`).join(" OR ");
    try {
      const payload = await fetchCardsByQuery({
        q,
        page: 1,
        pageSize: Math.min(250, batch.length),
        select: CATALOG_SET_PRICING_SELECT,
      });
      out.push(...payload.data);
    } catch {
      /* next chunk */
    }
  }
  return out;
}

/** Attach TCGPlayer prices to grid cards (DB sync often stores URL-only prices_json). */
export async function hydrateTcgCardSummariesWithLivePrices(
  setId: string,
  cards: TcgCardSummary[],
  catalogRows?: CatalogCardSummary[],
): Promise<TcgCardSummary[]> {
  if (!cards.length) return cards;

  let working = [...cards];

  const mergeFromLiveSet = (liveSet: TcgCardSummary[]) => {
    if (!liveSet.length) return;
    if (catalogRows?.length) {
      const enriched = enrichCardsWithLiveTcgPrices(catalogRows, liveSet);
      const byCatalogId = new Map(
        enriched.map((row) => [row.id, row]),
      );
      working = catalogRows.map((row) => {
        const enrichedRow = byCatalogId.get(row.id);
        if (!enrichedRow) {
          const existing = working.find((c) => c.id === row.id);
          return existing ?? catalogRowToSummaryWithPrices(row);
        }
        if ("tcgplayer" in enrichedRow && rowHasTcgEmbed(enrichedRow as TcgCardSummary)) {
          return applyLiveHit(
            working.find((c) => c.id === row.id) ?? catalogRowToSummaryWithPrices(row),
            enrichedRow as TcgCardSummary,
          );
        }
        if ("prices" in enrichedRow && enrichedRow.prices) {
          return catalogRowToSummaryWithPrices(enrichedRow, undefined);
        }
        return catalogRowToSummaryWithPrices(row, enrichedRow as TcgCardSummary);
      });
      if (cards.length < working.length) {
        const byId = new Map(working.map((c) => [c.id, c]));
        working = cards.map((c) => byId.get(c.id) ?? c);
      }
    } else {
      const byApiId = new Map(liveSet.map((l) => [l.id, l]));
      const byKey = new Map(liveSet.map((l) => [normalizeCardKey(l.name, l.number), l]));
      working = working.map((c) => {
        if (!needsTcgPlayerHydration(c)) return c;
        const apiId = pokemonApiCardId(c);
        const hit =
          (apiId ? byApiId.get(apiId) : undefined) ??
          byKey.get(normalizeCardKey(c.name, c.number));
        return hit ? applyLiveHit(c, hit) : c;
      });
    }
  };

  const mergeFromLiveCards = (liveCards: TcgCardSummary[]) => {
    if (!liveCards.length) return;
    const byApiId = new Map(liveCards.map((l) => [l.id, l]));
    const byKey = new Map(liveCards.map((l) => [normalizeCardKey(l.name, l.number), l]));
    working = working.map((c) => {
      if (!needsTcgPlayerHydration(c) && tcgSummaryHasFmv(c)) return c;
      const apiId = pokemonApiCardId(c);
      const hit =
        (apiId ? byApiId.get(apiId) : undefined) ??
        byKey.get(normalizeCardKey(c.name, c.number));
      return hit ? applyLiveHit(c, hit) : c;
    });
  };

  const stillMissingAfterRows = () => working.filter((c) => needsTcgPlayerHydration(c) || !tcgSummaryHasFmv(c));

  let missing = stillMissingAfterRows();
  if (!missing.length) return working;
  const initialMissing = missing.length;

  const idResolvable = missing.filter((c) => pokemonApiCardId(c));
  if (idResolvable.length >= Math.min(8, missing.length * 0.35)) {
    const liveCards = await fetchLiveByPokemonIds(
      idResolvable.map((c) => pokemonApiCardId(c)!),
    );
    mergeFromLiveCards(liveCards);
    missing = stillMissingAfterRows();
    if (!missing.length) return working;
  }

  if (missing.length <= 150) {
    const ids = missing.map((c) => pokemonApiCardId(c)).filter((id): id is string => Boolean(id));
    if (ids.length) {
      const liveCards = await fetchLiveByPokemonIds(ids);
      mergeFromLiveCards(liveCards);
      missing = stillMissingAfterRows();
      if (!missing.length || missing.length <= Math.max(2, Math.ceil(initialMissing * 0.12))) {
        return working;
      }
    }
  }

  try {
    const liveSet = await fetchAllCardsForSet({
      setId,
      select: CATALOG_SET_PRICING_SELECT,
    });
    mergeFromLiveSet(liveSet);
  } catch {
    /* per-id fallback below */
  }

  missing = stillMissingAfterRows();
  if (!missing.length) return working;

  const ids = missing.map((c) => pokemonApiCardId(c)).filter((id): id is string => Boolean(id));
  if (!ids.length) return working;

  const liveCards = await fetchLiveByPokemonIds(ids);
  mergeFromLiveCards(liveCards);
  return working;
}
