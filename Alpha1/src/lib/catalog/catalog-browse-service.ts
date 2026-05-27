import {
  countCardsInDb,
  countSetsInDb,
  getCardFromDb,
  listCardsFromDb,
  listSetsFromDb,
} from "@/lib/catalog/db-catalog-browse";
import { listMagicCards, listMagicSets, getMagicCard } from "@/lib/catalog/adapters/magic-browse";
import { listLorcanaCards, listLorcanaSets } from "@/lib/catalog/adapters/lorcana-browse";
import {
  getOnepieceCard,
  listOnepieceCards,
  listOnepieceSets,
} from "@/lib/catalog/adapters/onepiece-browse";
import { listYugiohCards, listYugiohSets, getYugiohCard } from "@/lib/catalog/adapters/yugioh-browse";
import type {
  CatalogCardSummary,
  CatalogFranchiseId,
  CatalogFranchiseMeta,
  CatalogPaginated,
  CatalogSetSummary,
} from "@/lib/catalog/catalog-types";
import {
  defaultFranchiseMeta,
  sortFranchiseMetas,
} from "@/lib/catalog/franchise-registry";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";

const FRANCHISE_IDS: CatalogFranchiseId[] = [
  "pokemon",
  "magic",
  "yugioh",
  "onepiece",
  "lorcana",
  "dragonball",
  "sports",
];

type LiveSetsFn = (p: {
  page: number;
  pageSize: number;
  q?: string;
}) => Promise<CatalogPaginated<CatalogSetSummary>>;

type LiveCardsFn = (
  setId: string,
  p: { page: number; pageSize: number; q?: string },
) => Promise<CatalogPaginated<CatalogCardSummary>>;

const LIVE_SETS: Partial<Record<CatalogFranchiseId, LiveSetsFn>> = {
  magic: listMagicSets,
  yugioh: listYugiohSets,
  onepiece: listOnepieceSets,
  lorcana: listLorcanaSets,
};

const LIVE_CARDS: Partial<Record<CatalogFranchiseId, LiveCardsFn>> = {
  magic: listMagicCards,
  yugioh: listYugiohCards,
  onepiece: listOnepieceCards,
  lorcana: listLorcanaCards,
};

export async function listCatalogFranchises(): Promise<CatalogFranchiseMeta[]> {
  let sourceRows: Array<{
    id: string;
    franchise: string;
    label: string;
    sync_enabled: boolean;
    last_synced_at: string | null;
  }> = [];

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from("tcg_catalog_sources")
      .select("id,franchise,label,sync_enabled,last_synced_at");
    sourceRows = (data ?? []) as typeof sourceRows;
  }

  const counts = await Promise.all(
    FRANCHISE_IDS.map((id) => countCardsInDb(id).catch(() => null)),
  );

  const metas = FRANCHISE_IDS.map((id, index) => {
    const base = defaultFranchiseMeta(id);
    const source = sourceRows.find((r) => r.franchise === id);
    return {
      ...base,
      sourceId: source?.id ?? base.sourceId,
      sourceLabel: source?.label ?? base.sourceLabel,
      syncEnabled: source?.sync_enabled ?? base.syncEnabled,
      lastSyncedAt: source?.last_synced_at ?? null,
      cardCountEstimate: counts[index],
    };
  });

  return sortFranchiseMetas(metas);
}

async function dbCachePopulated(franchise: CatalogFranchiseId): Promise<boolean> {
  const cardCount = await countCardsInDb(franchise).catch(() => null);
  if (cardCount != null && cardCount > 0) return true;
  const setCount = await countSetsInDb(franchise).catch(() => null);
  return setCount != null && setCount > 0;
}

export async function listCatalogSets(
  franchise: CatalogFranchiseId,
  params: { page: number; pageSize: number; q?: string },
): Promise<CatalogPaginated<CatalogSetSummary>> {
  const live = LIVE_SETS[franchise];
  const useDbFirst = await dbCachePopulated(franchise);

  if (useDbFirst) {
    const db = await listSetsFromDb(franchise, params);
    if (db && db.totalCount > 0 && db.data.length > 0) return db;
  }

  if (live) {
    try {
      return await live(params);
    } catch {
      const db = await listSetsFromDb(franchise, params);
      if (db && db.totalCount > 0) return db;
      throw new Error(`Unable to load ${franchise} sets`);
    }
  }

  const db = await listSetsFromDb(franchise, params);
  if (db && db.totalCount > 0) return db;

  return emptyPage(params);
}

export async function listCatalogCards(
  franchise: CatalogFranchiseId,
  setId: string,
  params: { page: number; pageSize: number; q?: string },
): Promise<CatalogPaginated<CatalogCardSummary>> {
  const live = LIVE_CARDS[franchise];
  const useDbFirst = await dbCachePopulated(franchise);

  if (useDbFirst) {
    const db = await listCardsFromDb(franchise, setId, params);
    if (db && db.totalCount > 0 && db.data.length > 0) return db;
  }

  if (live) {
    try {
      return await live(setId, params);
    } catch {
      const db = await listCardsFromDb(franchise, setId, params);
      if (db && db.totalCount > 0) return db;
      throw new Error(`Unable to load ${franchise} cards`);
    }
  }

  const db = await listCardsFromDb(franchise, setId, params);
  if (db && db.totalCount > 0) return db;

  return emptyPage(params);
}

export async function getCatalogCard(
  franchise: CatalogFranchiseId,
  catalogId: string,
): Promise<CatalogCardSummary | null> {
  const fromDb = await getCardFromDb(franchise, catalogId);
  if (fromDb) return fromDb;

  if (franchise === "magic") {
    return getMagicCard(catalogId);
  }
  if (franchise === "yugioh") {
    return getYugiohCard(catalogId);
  }
  if (franchise === "onepiece") {
    return getOnepieceCard(catalogId);
  }
  return null;
}

function emptyPage<T>(params: { page: number; pageSize: number }): CatalogPaginated<T> {
  return {
    data: [],
    page: params.page,
    pageSize: params.pageSize,
    count: 0,
    totalCount: 0,
  };
}
