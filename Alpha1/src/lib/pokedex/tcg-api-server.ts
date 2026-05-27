import type { TcgCardDetail, TcgCardSummary, TcgPaginated, TcgSetSummary } from "@/lib/pokedex/tcg-api-types";
import { countCardsInDb, listAllSetsFromDb, listCardsFromDb } from "@/lib/catalog/db-catalog-browse";
import type { CatalogSetSummary } from "@/lib/catalog/catalog-types";
import { expandLegendaryCollectionRows, isLegendaryCollectionCatalogExpand } from "@/lib/pokedex/legendary-collection-catalog";
import {
  buildSetCardsQuery,
  cardMatchesRarityBucket,
  countCardsByRarityBucket,
  rarityMatchesTerm,
  type RarityBucketId,
} from "@/lib/pokedex/rarity-buckets";
import {
  applyCatalogFinishClause,
  supportsFinishTabs,
  type CatalogFinishBucketId,
} from "@/lib/pokedex/set-catalog-config";
import type { PrintingPresetId } from "@/lib/pokedex/printing-presets";
import { setMatchesEra, type SetEraId } from "@/lib/pokedex/set-era";

const BASE = "https://api.pokemontcg.io/v2";
const ALL_SETS_CACHE_TTL_MS = 30 * 60 * 1000;

/** One download per search query — Vintage/Mid/Modern filter in-memory (era tabs were re-hitting the API). */
type AllSetsCacheEntry = { at: number; sets: TcgSetSummary[] };
const allSetsCache = new Map<string, AllSetsCacheEntry>();
const allSetsInFlight = new Map<string, Promise<TcgSetSummary[]>>();

function headers(): HeadersInit {
  const key = process.env.POKEMON_TCG_API_KEY?.trim();
  const h: HeadersInit = { Accept: "application/json" };
  if (key) (h as Record<string, string>)["X-Api-Key"] = key;
  return h;
}

async function fetchAllSetsFromApi(q?: string): Promise<TcgSetSummary[]> {
  const apiPageSize = 250;
  const aggregated: TcgSetSummary[] = [];
  let apiPage = 1;
  let totalFromApi = 0;

  do {
    const u = new URL(`${BASE}/sets`);
    u.searchParams.set("page", String(apiPage));
    u.searchParams.set("pageSize", String(apiPageSize));
    if (q) u.searchParams.set("q", q);
    u.searchParams.set("orderBy", "-releaseDate");

    const res = await fetch(u.toString(), { headers: headers(), next: { revalidate: 3600 } });
    if (!res.ok) {
      throw new Error(`TCG sets failed (${res.status})`);
    }
    const payload = (await res.json()) as TcgPaginated<TcgSetSummary>;
    totalFromApi = payload.totalCount;
    aggregated.push(...payload.data);
    if (payload.data.length === 0) break;
    apiPage += 1;
  } while (aggregated.length < totalFromApi);

  return aggregated;
}

async function getAllSetsCached(q?: string): Promise<TcgSetSummary[]> {
  const cacheKey = q?.trim() || "";
  const hit = allSetsCache.get(cacheKey);
  if (hit && Date.now() - hit.at < ALL_SETS_CACHE_TTL_MS) {
    return hit.sets;
  }

  let pending = allSetsInFlight.get(cacheKey);
  if (!pending) {
    pending = fetchAllSetsFromApi(cacheKey || undefined)
      .then((sets) => {
        allSetsCache.set(cacheKey, { at: Date.now(), sets });
        allSetsInFlight.delete(cacheKey);
        return sets;
      })
      .catch((err) => {
        allSetsInFlight.delete(cacheKey);
        if (hit) return hit.sets;
        throw err;
      });
    allSetsInFlight.set(cacheKey, pending);
  }

  return pending;
}

function catalogSetToTcgSet(row: CatalogSetSummary): TcgSetSummary {
  return {
    id: row.id,
    name: row.name,
    series: row.series ?? "",
    printedTotal: row.printedTotal ?? row.total ?? 0,
    total: row.total ?? row.printedTotal ?? 0,
    releaseDate: row.releaseDate ?? "",
    images: row.images,
  };
}

async function fetchSetsPageFromDb(params: {
  page: number;
  pageSize: number;
  q?: string;
  orderBy?: string;
  era: SetEraId;
}): Promise<TcgPaginated<TcgSetSummary> | null> {
  const populated = await countCardsInDb("pokemon");
  if (!populated || populated <= 0) return null;

  const orderBy = params.orderBy?.trim() || "-releaseDate";
  const outPageSize = Math.min(250, Math.max(1, params.pageSize));
  const outPage = Math.max(1, params.page);

  const aggregated = (await listAllSetsFromDb("pokemon", params.q)).map(catalogSetToTcgSet);
  const filtered = aggregated.filter((s) => setMatchesEra(s.releaseDate, params.era));

  filtered.sort((a, b) => {
    const cmp = a.releaseDate.localeCompare(b.releaseDate);
    return orderBy.startsWith("-") ? -cmp : cmp;
  });

  const totalCount = filtered.length;
  const start = (outPage - 1) * outPageSize;
  const data = filtered.slice(start, start + outPageSize);

  if (totalCount === 0) return null;

  return {
    data,
    page: outPage,
    pageSize: outPageSize,
    count: data.length,
    totalCount,
  };
}

async function loadSetCardsFromDb(setId: string, variantKey?: string | null): Promise<TcgCardSummary[] | null> {
  const populated = await countCardsInDb("pokemon");
  if (!populated || populated <= 0) return null;

  const db = await listCardsFromDb("pokemon", setId, {
    page: 1,
    pageSize: 5000,
    variantKey: variantKey ?? null,
    includeVariants: true,
  });
  if (!db || db.totalCount === 0) return null;

  return db.data.map((row) => ({
    id: row.id,
    name: row.name,
    number: row.number ?? "",
    rarity: row.rarity ?? undefined,
    catalogFinish: row.catalogFinish,
    catalogVariantKey: row.catalogVariantKey,
    catalogVariantLabel: row.catalogVariantLabel,
    sourceCatalogId: row.sourceCatalogId,
    images: row.images,
    set: row.set
      ? {
          id: row.set.id,
          name: row.set.name,
          releaseDate: row.set.releaseDate ?? undefined,
        }
      : undefined,
    tcgplayer: row.tcgplayer?.url ? { url: row.tcgplayer.url } : undefined,
  }));
}

export async function fetchRarityCountsForSet(setId: string): Promise<Record<RarityBucketId, number> | null> {
  const cards = await loadSetCardsFromDb(setId.trim());
  if (!cards) return null;
  return countCardsByRarityBucket(cards);
}

function filterCardsByFinish(
  cards: TcgCardSummary[],
  setId: string,
  finish: CatalogFinishBucketId,
): TcgCardSummary[] {
  if (finish === "all") return cards;
  if (finish === "reverse_holo") {
    return cards.filter(
      (c) => c.catalogFinish === "reverse_holo" || c.catalogVariantKey === "reverse_holo",
    );
  }
  if (!supportsFinishTabs(setId)) return cards;
  if (finish === "rare_holo") {
    return cards.filter((c) => {
      const r = c.rarity ?? "";
      return (
        rarityMatchesTerm(r, "Rare Holo") ||
        r.startsWith("Rare Holo") ||
        /^Rare Holo\b/i.test(r)
      );
    });
  }
  if (finish === "rare_non_holo") {
    return cards.filter((c) => rarityMatchesTerm(c.rarity ?? "", "Rare"));
  }
  return cards;
}

async function fetchCardsForSetPageFromDb(params: {
  setId: string;
  page: number;
  pageSize: number;
  variantKey?: string | null;
  rarityBucket?: RarityBucketId;
  finishBucket?: CatalogFinishBucketId;
}): Promise<TcgPaginated<TcgCardSummary> | null> {
  const cards = await loadSetCardsFromDb(params.setId, params.variantKey);
  if (!cards) return null;

  const bucket = params.rarityBucket ?? "all";
  const finish = params.finishBucket ?? "all";
  let filtered =
    bucket === "all"
      ? cards
      : cards.filter((c) => cardMatchesRarityBucket(c.rarity, bucket));
  filtered = filterCardsByFinish(filtered, params.setId, finish);

  const page = Math.max(1, params.page);
  const pageSize = Math.max(1, params.pageSize);
  const start = (page - 1) * pageSize;
  const data = filtered.slice(start, start + pageSize);

  return {
    data,
    page,
    pageSize,
    count: data.length,
    totalCount: filtered.length,
  };
}

export async function fetchSetsPage(params: {
  page: number;
  pageSize: number;
  /** Lucene-style query e.g. `name:*dragon*` — do not combine with `releaseDate` ranges (API returns 400 on sets). */
  q?: string;
  /** e.g. `-releaseDate` (newest first), `releaseDate` (oldest first), often from {@link setEraToOrderBy}. */
  orderBy?: string;
  /** Applied in-app after aggregating API pages (API cannot filter sets by releaseDate range in `q`). */
  era: SetEraId;
}): Promise<TcgPaginated<TcgSetSummary>> {
  const orderBy = params.orderBy?.trim() || "-releaseDate";
  const outPageSize = Math.min(250, Math.max(1, params.pageSize));
  const outPage = Math.max(1, params.page);

  const fromDb = await fetchSetsPageFromDb(params);
  if (fromDb) return fromDb;

  try {
    const aggregated = await getAllSetsCached(params.q);
    const filtered = aggregated.filter((s) => setMatchesEra(s.releaseDate, params.era));

    filtered.sort((a, b) => {
      const cmp = a.releaseDate.localeCompare(b.releaseDate);
      return orderBy.startsWith("-") ? -cmp : cmp;
    });

    const totalCount = filtered.length;
    const start = (outPage - 1) * outPageSize;
    const data = filtered.slice(start, start + outPageSize);

    return {
      data,
      page: outPage,
      pageSize: outPageSize,
      count: data.length,
      totalCount,
    };
  } catch {
    const fallback = await fetchSetsPageFromDb(params);
    if (fallback) return fallback;
    throw new Error("Unable to load Pokémon sets");
  }
}

export async function fetchSetById(setId: string): Promise<TcgSetSummary | null> {
  const id = setId.trim();
  if (!id) return null;

  const populated = await countCardsInDb("pokemon");
  if (populated && populated > 0) {
    const sets = await listAllSetsFromDb("pokemon");
    const hit = sets.find((s) => s.id === id || s.code === id);
    if (hit) return catalogSetToTcgSet(hit);
  }

  const res = await fetch(`${BASE}/sets/${encodeURIComponent(id)}`, {
    headers: headers(),
    next: { revalidate: 3600 },
  });
  if (!res.ok) return null;
  const payload = (await res.json()) as { data?: TcgSetSummary };
  return payload.data ?? null;
}

/** Default `select` for set-level pricing rollups (keeps payloads smaller than full card). */
export const CATALOG_SET_PRICING_SELECT =
  "id,name,number,rarity,tcgplayer,cardmarket,set" as const;

export async function fetchAllCardsForSet(params: {
  setId: string;
  select?: string;
}): Promise<TcgCardSummary[]> {
  const setId = params.setId.trim();
  if (!setId) throw new Error("setId required");
  const select = params.select?.trim() || CATALOG_SET_PRICING_SELECT;
  const q = `set.id:${setId}`;
  const out: TcgCardSummary[] = [];
  let page = 1;
  const pageSize = 250;
  for (;;) {
    const payload = await fetchCardsByQuery({ q, page, pageSize, select });
    out.push(...payload.data);
    if (payload.data.length < pageSize || out.length >= payload.totalCount) break;
    page += 1;
  }
  return out;
}

export async function fetchCardsByQuery(params: {
  q: string;
  page: number;
  pageSize: number;
  /** Comma-separated field paths per Pokémon TCG API `select` */
  select?: string;
}): Promise<TcgPaginated<TcgCardSummary>> {
  const u = new URL(`${BASE}/cards`);
  u.searchParams.set("q", params.q.trim());
  u.searchParams.set("page", String(Math.max(1, params.page)));
  u.searchParams.set("pageSize", String(Math.min(250, Math.max(1, params.pageSize))));
  u.searchParams.set("orderBy", "number");
  const sel = params.select?.trim();
  if (sel) u.searchParams.set("select", sel);

  const res = await fetch(u.toString(), { headers: headers(), next: { revalidate: 3600 } });
  if (!res.ok) {
    throw new Error(`TCG cards failed (${res.status})`);
  }
  return (await res.json()) as TcgPaginated<TcgCardSummary>;
}

export async function fetchPokemonCardById(
  cardId: string,
  options?: { cache?: RequestCache },
): Promise<TcgCardDetail | null> {
  const id = cardId.trim();
  if (!id) return null;
  const fetchInit: RequestInit =
    options?.cache === "no-store"
      ? { headers: headers(), cache: "no-store" }
      : { headers: headers(), next: { revalidate: 1800 } };
  const res = await fetch(`${BASE}/cards/${encodeURIComponent(id)}`, fetchInit);
  if (!res.ok) return null;
  const payload = (await res.json()) as { data?: TcgCardDetail };
  return payload.data ?? null;
}

export async function fetchCardsForSetPage(params: {
  setId: string;
  page: number;
  pageSize: number;
  rarityBucket?: RarityBucketId;
  finishBucket?: CatalogFinishBucketId;
  printingPreset?: PrintingPresetId;
}): Promise<TcgPaginated<TcgCardSummary>> {
  const setId = params.setId.trim();
  if (!setId) throw new Error("setId required");
  const bucket = params.rarityBucket ?? "all";
  const finish = params.finishBucket ?? "all";
  const printingPreset = params.printingPreset ?? "catalog";
  let q = buildSetCardsQuery(setId, bucket);
  q = applyCatalogFinishClause(q, setId, finish);

  const dbVariantKey =
    finish === "reverse_holo"
      ? "reverse_holo"
      : printingPreset !== "catalog"
        ? printingPreset
        : null;

  const fromDb = await fetchCardsForSetPageFromDb({
    setId,
    page: params.page,
    pageSize: params.pageSize,
    variantKey: dbVariantKey,
    rarityBucket: bucket,
    finishBucket: finish,
  });
  if (fromDb) return fromDb;

  if (!isLegendaryCollectionCatalogExpand(setId)) {
    try {
      return await fetchCardsByQuery({ q, page: params.page, pageSize: params.pageSize });
    } catch {
      const fallback = await fetchCardsForSetPageFromDb({
        setId,
        page: params.page,
        pageSize: params.pageSize,
        rarityBucket: bucket,
        finishBucket: finish,
        variantKey: dbVariantKey,
      });
      if (fallback) return fallback;
      throw new Error(`TCG cards failed for set ${setId}`);
    }
  }

  const all: TcgCardSummary[] = [];
  let apiPage = 1;
  const apiPageSize = 250;
  for (;;) {
    const chunk = await fetchCardsByQuery({ q, page: apiPage, pageSize: apiPageSize });
    all.push(...chunk.data);
    if (chunk.data.length < apiPageSize || all.length >= chunk.totalCount) break;
    apiPage += 1;
  }

  const expanded = expandLegendaryCollectionRows(all);
  const totalCount = expanded.length;
  const page = Math.max(1, params.page);
  const pageSize = Math.max(1, params.pageSize);
  const start = (page - 1) * pageSize;
  const data = expanded.slice(start, start + pageSize);

  return {
    data,
    page,
    pageSize,
    count: data.length,
    totalCount,
  };
}
