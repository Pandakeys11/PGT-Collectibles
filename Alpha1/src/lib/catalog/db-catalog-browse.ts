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
};

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

  if (params.q?.trim()) {
    const needle = `%${params.q.trim().slice(0, 48).replace(/[%_]/g, "")}%`;
    query = query.or(`name.ilike.${needle},code.ilike.${needle}`);
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
  params: { page: number; pageSize: number; q?: string },
): Promise<CatalogPaginated<CatalogCardSummary> | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabaseAdmin();
  const from = (params.page - 1) * params.pageSize;
  const to = from + params.pageSize - 1;

  const { data: setRow } = await supabase
    .from("tcg_catalog_sets")
    .select("external_set_id,name,code")
    .eq("franchise", franchise)
    .eq("external_set_id", setId)
    .maybeSingle();

  const setName = (setRow as { name?: string } | null)?.name ?? null;
  const setCode = (setRow as { code?: string } | null)?.code ?? null;

  let query = supabase
    .from("tcg_catalog_cards")
    .select(
      "catalog_id,name,printed_name,set_name,set_code,card_number,year,rarity,image_small_url,image_large_url,prices_json",
      { count: "exact" },
    )
    .eq("franchise", franchise);

  if (setCode) {
    query = query.eq("set_code", setCode);
  } else if (setName) {
    query = query.eq("set_name", setName);
  } else {
    query = query.or(`set_code.eq.${setId},set_name.ilike.%${setId}%`);
  }

  if (params.q?.trim()) {
    const needle = `%${params.q.trim().slice(0, 48).replace(/[%_]/g, "")}%`;
    query = query.ilike("name", needle);
  }

  query = query.order("card_number", { ascending: true, nullsFirst: false });

  const { data, error, count } = await query.range(from, to);
  if (error) {
    return { data: [], page: params.page, pageSize: params.pageSize, count: 0, totalCount: 0 };
  }

  const rows = (data ?? []) as DbCardRow[];
  const setSummary = setRow
    ? {
        id: setId,
        name: setName ?? setId,
        code: setCode,
      }
    : { id: setId, name: setId, code: null };

  return {
    data: rows.map((row) => dbCardToSummary(franchise, row, setSummary)),
    page: params.page,
    pageSize: params.pageSize,
    count: rows.length,
    totalCount: count ?? rows.length,
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
      "catalog_id,name,printed_name,set_name,set_code,card_number,year,rarity,image_small_url,image_large_url,prices_json",
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
    name: row.printed_name?.trim() || row.name,
    number: row.card_number,
    rarity: row.rarity,
    supertype: null,
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
