import type { TcgCardDetail, TcgCardSummary, TcgPaginated, TcgSetSummary } from "@/lib/pokedex/tcg-api-types";
import { expandLegendaryCollectionRows, isLegendaryCollectionCatalogExpand } from "@/lib/pokedex/legendary-collection-catalog";
import { buildSetCardsQuery, type RarityBucketId } from "@/lib/pokedex/rarity-buckets";
import { applyCatalogFinishClause, type CatalogFinishBucketId } from "@/lib/pokedex/set-catalog-config";
import { setMatchesEra, type SetEraId } from "@/lib/pokedex/set-era";

const BASE = "https://api.pokemontcg.io/v2";

function headers(): HeadersInit {
  const key = process.env.POKEMON_TCG_API_KEY?.trim();
  const h: HeadersInit = { Accept: "application/json" };
  if (key) (h as Record<string, string>)["X-Api-Key"] = key;
  return h;
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
  const apiPageSize = 250;
  const outPageSize = Math.min(250, Math.max(1, params.pageSize));
  const outPage = Math.max(1, params.page);
  const q = params.q?.trim();

  const aggregated: TcgSetSummary[] = [];
  let apiPage = 1;
  let totalFromApi = 0;
  do {
    const u = new URL(`${BASE}/sets`);
    u.searchParams.set("page", String(apiPage));
    u.searchParams.set("pageSize", String(apiPageSize));
    if (q) u.searchParams.set("q", q);
    u.searchParams.set("orderBy", orderBy);

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
}

export async function fetchSetById(setId: string): Promise<TcgSetSummary | null> {
  const id = setId.trim();
  if (!id) return null;
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
}): Promise<TcgPaginated<TcgCardSummary>> {
  const setId = params.setId.trim();
  if (!setId) throw new Error("setId required");
  const bucket = params.rarityBucket ?? "all";
  const finish = params.finishBucket ?? "all";
  let q = buildSetCardsQuery(setId, bucket);
  q = applyCatalogFinishClause(q, setId, finish);

  if (!isLegendaryCollectionCatalogExpand(setId)) {
    return fetchCardsByQuery({ q, page: params.page, pageSize: params.pageSize });
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
