import { listCardsFromDb } from "@/lib/catalog/db-catalog-browse";
import { upsertCatalogCards } from "@/lib/catalog/db-catalog";
import {
  enrichCardsWithLiveTcgPrices,
  priceSnapshotFromTcgCard,
  rollupSetInsightCards,
  type SetInsightCardSource,
} from "@/lib/catalog/set-insight-utils";
import { persistTcgReferenceCompsForCatalogCard } from "@/lib/market/catalog-tcg-reference-comps";
import { bestCatalogUsd } from "@/lib/market/catalog-price-utils";
import { parseCatalogPriceSnapshot } from "@/lib/market/catalog-reference-evidence";
import {
  CATALOG_SET_PRICING_SELECT,
  fetchAllCardsForSet,
} from "@/lib/pokedex/tcg-api-server";
import type { CatalogCardSummary } from "@/lib/catalog/catalog-types";
import type { TcgCardSummary } from "@/lib/pokedex/tcg-api-types";

export type SetCatalogPriceSyncResult = {
  setId: string;
  cardCount: number;
  pricesUpdated: number;
  referenceComps: number;
  pricedPct: number;
};

function priceJsonFromCard(card: SetInsightCardSource): Record<string, unknown> | null {
  if ("prices" in card && card.prices && bestCatalogUsd(card.prices) != null) {
    const p = card.prices;
    return {
      tcgPlayerUrl: p.tcgPlayerUrl,
      tcgPlayerUpdatedAt: p.tcgPlayerUpdatedAt,
      tcgPlayerPrices: p.tcgPlayerPrices,
      cardMarketUrl: p.cardMarketUrl,
      cardMarketUpdatedAt: p.cardMarketUpdatedAt,
      cardMarket: p.cardMarket,
      priceChartingLooseUsd: p.priceChartingLooseUsd,
      priceChartingUrl: p.priceChartingUrl,
      priceChartingUpdatedAt: p.priceChartingUpdatedAt,
    };
  }
  if ("tcgplayer" in card || "cardmarket" in card) {
    return priceSnapshotFromTcgCard(card as TcgCardSummary) as unknown as Record<string, unknown>;
  }
  return null;
}

function catalogUpsertFromRow(
  row: CatalogCardSummary,
  pricesJson: Record<string, unknown>,
): Parameters<typeof upsertCatalogCards>[0][number] {
  return {
    franchise: "pokemon",
    catalogId: row.id,
    name: row.name,
    printedName: row.name,
    setName: row.set?.name ?? null,
    setCode: row.set?.code ?? null,
    cardNumber: row.number,
    year: row.set?.releaseDate?.slice(0, 4) ?? null,
    rarity: row.rarity,
    imageSmallUrl: row.images?.small ?? null,
    imageLargeUrl: row.images?.large ?? null,
    pricesJson,
    rawJson: {
      pokemonId: row.sourceCatalogId ?? row.id,
      catalogVariantKey: row.catalogVariantKey,
    },
    sourceId: "pokemontcg.io",
  };
}

/**
 * Backfill `tcg_catalog_cards.prices_json` from Pokémon TCG API for an entire set
 * and write TCGPlayer reference comps to `pgt_market_comps`.
 */
export async function syncSetCatalogPricesFromTcgApi(
  setId: string,
): Promise<SetCatalogPriceSyncResult> {
  const empty: SetCatalogPriceSyncResult = {
    setId,
    cardCount: 0,
    pricesUpdated: 0,
    referenceComps: 0,
    pricedPct: 0,
  };

  const page = await listCardsFromDb("pokemon", setId, {
    page: 1,
    pageSize: 3000,
    includeVariants: true,
  });
  if (!page?.data.length) return empty;

  let cards: SetInsightCardSource[] = page.data;
  let liveCards: TcgCardSummary[] = [];
  try {
    liveCards = await fetchAllCardsForSet({
      setId,
      select: CATALOG_SET_PRICING_SELECT,
    });
  } catch {
    liveCards = [];
  }

  if (liveCards.length) {
    cards = enrichCardsWithLiveTcgPrices(page.data, liveCards);
  }

  let pricesUpdated = 0;
  let referenceComps = 0;
  const upserts: Parameters<typeof upsertCatalogCards>[0] = [];

  for (const card of cards) {
    const row = page.data.find((r) => r.id === card.id);
    if (!row) continue;

    const pricesJson = priceJsonFromCard(card);
    if (!pricesJson) continue;

    const snap = parseCatalogPriceSnapshot(pricesJson);
    if (bestCatalogUsd(snap) == null) continue;

    upserts.push(catalogUpsertFromRow(row, pricesJson));
    pricesUpdated += 1;

    referenceComps += await persistTcgReferenceCompsForCatalogCard({
      catalogId: row.id,
      name: row.name,
      number: row.number,
      setName: row.set?.name ?? null,
      prices: snap,
    });
  }

  if (upserts.length) {
    await upsertCatalogCards(upserts);
  }

  const rollup = rollupSetInsightCards(cards);
  const pricedPct =
    rollup.cardCount > 0
      ? Math.round((100 * rollup.pricedSlots) / rollup.cardCount)
      : 0;

  return {
    setId,
    cardCount: rollup.cardCount,
    pricesUpdated,
    referenceComps,
    pricedPct,
  };
}
