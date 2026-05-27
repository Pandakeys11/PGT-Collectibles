import type {
  CatalogCardSummary,
  CatalogFranchiseId,
  CatalogPaginated,
  CatalogSetSummary,
} from "@/lib/catalog/catalog-types";
import { releaseYearFromDate } from "@/lib/catalog/catalog-types";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";

type DbSetRow = {
  external_set_id: string;
  name: string;
  code: string | null;
  release_date: string | null;
  card_count: number | null;
  raw_json: Record<string, unknown> | null;
};

const MAX_DB_CARDS_PER_SET = 3000;

function escapeFilterValue(value: string): string {
  return value.replace(/[%_(),]/g, "");
}

export function normalizeCatalogBrowseSearch(raw?: string): string {
  return (raw ?? "")
    .replace(/\b(?:set\.name|name|set|code):/gi, " ")
    .replace(/["'()*]/g, " ")
    .replace(/\*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function resolveSetRecord(
  franchise: CatalogFranchiseId,
  setId: string,
): Promise<DbSetRow | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabaseAdmin();
  const needle = normalizeCatalogBrowseSearch(setId) || setId.trim();
  if (!needle) return null;

  const select =
    "external_set_id,name,code,release_date,card_count,raw_json" as const;

  const byExternal = await supabase
    .from("tcg_catalog_sets")
    .select(select)
    .eq("franchise", franchise)
    .eq("external_set_id", needle)
    .maybeSingle();
  if (byExternal.data) return byExternal.data as DbSetRow;

  const byCode = await supabase
    .from("tcg_catalog_sets")
    .select(select)
    .eq("franchise", franchise)
    .eq("code", needle)
    .maybeSingle();
  if (byCode.data) return byCode.data as DbSetRow;

  const safe = escapeFilterValue(needle.slice(0, 64));
  if (safe) {
    const byName = await supabase
      .from("tcg_catalog_sets")
      .select(select)
      .eq("franchise", franchise)
      .ilike("name", `%${safe}%`)
      .limit(1)
      .maybeSingle();
    if (byName.data) return byName.data as DbSetRow;
  }

  return null;
}

function cardFilterForSet(
  setId: string,
  setRow: DbSetRow | null,
): { mode: "code" | "name" | "fallback"; value: string } {
  const code = setRow?.code?.trim() || setRow?.external_set_id?.trim();
  if (code) return { mode: "code", value: code };
  const name = setRow?.name?.trim();
  if (name) return { mode: "name", value: name };
  return { mode: "fallback", value: setId.trim() };
}

type DbCardRow = {
  catalog_id: string;
  name: string;
  printed_name: string | null;
  set_name: string | null;
  set_code: string | null;
  card_number: string | null;
  year: string | null;
  rarity: string | null;
  image_small_url: string | null;
  image_large_url: string | null;
  prices_json: Record<string, unknown> | null;
  raw_json: Record<string, unknown> | null;
};

type CardSetFilter = { mode: "code" | "name" | "fallback"; value: string };

function setVisibilityFilterForBrowse(): string {
  const today = new Date().toISOString().slice(0, 10);
  return `release_date.lte.${today},release_date.is.null,card_count.gt.0,card_count.is.null`;
}

function cardNumberSortParts(value: string | null | undefined): {
  prefix: string;
  number: number;
  suffix: string;
  raw: string;
} {
  const raw = (value ?? "").trim();
  const match = raw.match(/^(.*?)(\d+)([a-zA-Z]*)$/) ?? raw.match(/^(.*?)(\d+)(.*)$/);
  if (!match) {
    return {
      prefix: raw.toLowerCase(),
      number: Number.POSITIVE_INFINITY,
      suffix: "",
      raw: raw.toLowerCase(),
    };
  }
  return {
    prefix: (match[1] ?? "").toLowerCase(),
    number: Number.parseInt(match[2] ?? "0", 10),
    suffix: (match[3] ?? "").toLowerCase(),
    raw: raw.toLowerCase(),
  };
}

function compareDbCardsByCollectorNumber(a: DbCardRow, b: DbCardRow): number {
  const aParts = cardNumberSortParts(a.card_number);
  const bParts = cardNumberSortParts(b.card_number);
  return (
    aParts.prefix.localeCompare(bParts.prefix) ||
    aParts.number - bParts.number ||
    aParts.suffix.localeCompare(bParts.suffix) ||
    aParts.raw.localeCompare(bParts.raw) ||
    (a.name ?? "").localeCompare(b.name ?? "")
  );
}

function catalogVariantKey(row: DbCardRow): string | null {
  const raw = row.raw_json ?? {};
  const key = raw.catalogVariantKey;
  return typeof key === "string" && key.trim() ? key.trim() : null;
}

function catalogVariantLabel(row: DbCardRow): string | null {
  const raw = row.raw_json ?? {};
  const label = raw.variantLabel;
  return typeof label === "string" && label.trim() ? label.trim() : null;
}

function sourceCatalogId(row: DbCardRow): string | null {
  const raw = row.raw_json ?? {};
  const id = raw.sourceCatalogId ?? raw.pokemonId;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

/** Prefer column rarity; fall back to Pokémon TCG API raw_json.rarity when column is empty. */
export function resolveCatalogCardRarity(row: {
  rarity?: string | null;
  raw_json?: Record<string, unknown> | null;
}): string | null {
  const col = row.rarity?.trim();
  if (col) return col;
  const raw = row.raw_json ?? {};
  const fromRaw = raw.rarity;
  return typeof fromRaw === "string" && fromRaw.trim() ? fromRaw.trim() : null;
}

export async function listSetsFromDb(
  franchise: CatalogFranchiseId,
  params: { page: number; pageSize: number; q?: string },
): Promise<CatalogPaginated<CatalogSetSummary> | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabaseAdmin();
  const from = (params.page - 1) * params.pageSize;
  const to = from + params.pageSize - 1;

  let query = supabase
    .from("tcg_catalog_sets")
    .select("external_set_id,name,code,release_date,card_count,raw_json", { count: "exact" })
    .eq("franchise", franchise)
    .order("release_date", { ascending: false, nullsFirst: false });

  const search = normalizeCatalogBrowseSearch(params.q);
  if (search) {
    const needle = `%${search.slice(0, 48).replace(/[%_]/g, "")}%`;
    query = query.or(`name.ilike.${needle},code.ilike.${needle}`);
  } else {
    query = query.or(setVisibilityFilterForBrowse());
  }

  const { data, error, count } = await query.range(from, to);
  if (error) {
    return { data: [], page: params.page, pageSize: params.pageSize, count: 0, totalCount: 0 };
  }
  if (!data?.length) {
    return { data: [], page: params.page, pageSize: params.pageSize, count: 0, totalCount: count ?? 0 };
  }

  const rows = data as DbSetRow[];
  return {
    data: rows.map((row) => dbSetToSummary(franchise, row)),
    page: params.page,
    pageSize: params.pageSize,
    count: rows.length,
    totalCount: count ?? rows.length,
  };
}

export async function listCardsFromDb(
  franchise: CatalogFranchiseId,
  setId: string,
  params: { page: number; pageSize: number; q?: string; variantKey?: string | null; includeVariants?: boolean },
): Promise<CatalogPaginated<CatalogCardSummary> | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabaseAdmin();
  const from = (params.page - 1) * params.pageSize;
  const to = from + params.pageSize - 1;

  const setRow = await resolveSetRecord(franchise, setId);
  const filter = cardFilterForSet(setId, setRow);
  const search = normalizeCatalogBrowseSearch(params.q);

  const runCardQuery = async (activeFilter: CardSetFilter) => {
    let query = supabase
      .from("tcg_catalog_cards")
      .select(
        "catalog_id,name,printed_name,set_name,set_code,card_number,year,rarity,image_small_url,image_large_url,prices_json,raw_json",
        { count: "exact" },
      )
      .eq("franchise", franchise);

    if (activeFilter.mode === "code") {
      query = query.eq("set_code", activeFilter.value);
    } else if (activeFilter.mode === "name") {
      query = query.eq("set_name", activeFilter.value);
    } else {
      const safe = escapeFilterValue(activeFilter.value.slice(0, 48));
      query = query.or(`set_code.eq.${safe},set_name.ilike.%${safe}%`);
    }

    if (search) {
      const needle = `%${search.slice(0, 48).replace(/[%_]/g, "")}%`;
      query = query.ilike("name", needle);
    }

    return query.range(0, MAX_DB_CARDS_PER_SET - 1);
  };

  let { data, error } = await runCardQuery(filter);
  if (!error && !data?.length && setRow?.name && filter.mode !== "name") {
    ({ data, error } = await runCardQuery({ mode: "name", value: setRow.name }));
  }
  if (error) {
    console.error(`[catalog] listCardsFromDb ${franchise}/${setId}:`, error.message);
    return { data: [], page: params.page, pageSize: params.pageSize, count: 0, totalCount: 0 };
  }

  const variantKey = params.variantKey?.trim() || null;
  const rows = ((data ?? []) as DbCardRow[])
    .filter((row) => {
      const key = catalogVariantKey(row);
      if (variantKey) return key === variantKey;
      if (params.includeVariants) return true;
      return !key;
    })
    .sort(compareDbCardsByCollectorNumber);
  const pageRows = rows.slice(from, to + 1);
  const setSummary = setRow
    ? {
        id: setRow.external_set_id,
        name: setRow.name,
        code: setRow.code,
      }
    : { id: setId, name: setId, code: null };

  return {
    data: pageRows.map((row) => dbCardToSummary(franchise, row, setSummary)),
    page: params.page,
    pageSize: params.pageSize,
    count: pageRows.length,
    totalCount: rows.length,
  };
}

export async function getCardFromDb(
  franchise: CatalogFranchiseId,
  catalogId: string,
): Promise<CatalogCardSummary | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("tcg_catalog_cards")
    .select(
      "catalog_id,name,printed_name,set_name,set_code,card_number,year,rarity,image_small_url,image_large_url,prices_json,raw_json",
    )
    .eq("franchise", franchise)
    .eq("catalog_id", catalogId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as DbCardRow;
  return dbCardToSummary(franchise, row, {
    id: row.set_code ?? row.set_name ?? "unknown",
    name: row.set_name ?? "Unknown set",
    code: row.set_code,
  });
}

export async function countCardsInDb(franchise: CatalogFranchiseId): Promise<number | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabaseAdmin();
  const { count, error } = await supabase
    .from("tcg_catalog_cards")
    .select("catalog_id", { count: "exact", head: true })
    .eq("franchise", franchise);
  if (error) return null;
  return count ?? 0;
}

export async function countSetsInDb(franchise: CatalogFranchiseId): Promise<number | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabaseAdmin();
  const { count, error } = await supabase
    .from("tcg_catalog_sets")
    .select("external_set_id", { count: "exact", head: true })
    .eq("franchise", franchise);
  if (error) return null;
  return count ?? 0;
}

/** Load all cached sets for a franchise (internal browse helpers). */
export async function listAllSetsFromDb(
  franchise: CatalogFranchiseId,
  q?: string,
): Promise<CatalogSetSummary[]> {
  const out: CatalogSetSummary[] = [];
  let page = 1;
  const pageSize = 100;
  for (;;) {
    const batch = await listSetsFromDb(franchise, { page, pageSize, q });
    if (!batch?.data.length) break;
    out.push(...batch.data);
    if (page * pageSize >= batch.totalCount) break;
    page += 1;
  }
  return out;
}

function dbSetToSummary(franchise: CatalogFranchiseId, row: DbSetRow): CatalogSetSummary {
  const releaseDate = row.release_date ?? null;
  const raw = row.raw_json ?? {};
  const images = raw.images as { symbol?: string; logo?: string } | undefined;
  return {
    id: row.external_set_id,
    name: row.name,
    code: row.code,
    series: typeof raw.series === "string" ? raw.series : null,
    releaseDate,
    year: releaseYearFromDate(releaseDate),
    printedTotal: row.card_count,
    total: row.card_count,
    images,
    franchise,
  };
}

function dbCardToSummary(
  franchise: CatalogFranchiseId,
  row: DbCardRow,
  set: { id: string; name: string; code?: string | null },
): CatalogCardSummary {
  const prices = row.prices_json ?? {};
  return {
    id: row.catalog_id,
    name: row.name,
    number: row.card_number,
    rarity: resolveCatalogCardRarity(row),
    supertype: null,
    catalogFinish: catalogVariantKey(row) === "reverse_holo" ? "reverse_holo" : undefined,
    catalogVariantKey: catalogVariantKey(row),
    catalogVariantLabel: catalogVariantLabel(row),
    sourceCatalogId: sourceCatalogId(row),
    images: {
      small: row.image_small_url ?? undefined,
      large: row.image_large_url ?? row.image_small_url ?? undefined,
    },
    set: {
      id: set.id,
      name: set.name,
      code: set.code ?? row.set_code,
      releaseDate: row.year ? `${row.year}-01-01` : undefined,
    },
    franchise,
    tcgplayer:
      typeof prices.tcgPlayerUrl === "string"
        ? { url: prices.tcgPlayerUrl }
        : undefined,
  };
}

export type CatalogSetUpsert = {
  franchise: CatalogFranchiseId;
  externalSetId: string;
  name: string;
  code?: string | null;
  releaseDate?: string | null;
  cardCount?: number | null;
  sourceId: string;
  rawJson?: Record<string, unknown>;
};

export async function upsertCatalogSets(rows: CatalogSetUpsert[]): Promise<number> {
  if (!isSupabaseConfigured() || rows.length === 0) return 0;
  const supabase = getSupabaseAdmin();
  const payload = rows.map((row) => ({
    franchise: row.franchise,
    external_set_id: row.externalSetId,
    name: row.name,
    code: row.code ?? null,
    release_date: row.releaseDate ?? null,
    card_count: row.cardCount ?? null,
    source_id: row.sourceId,
    raw_json: row.rawJson ?? {},
    synced_at: new Date().toISOString(),
  }));
  const { error } = await supabase.from("tcg_catalog_sets").upsert(payload, {
    onConflict: "franchise,external_set_id",
  });
  if (error) throw new Error(error.message);
  return payload.length;
}
