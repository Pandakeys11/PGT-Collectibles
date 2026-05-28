import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";

const CURSOR_SOURCE_ID = "pokemontcg.io";

export type SetIngestCursor = {
  /** Index into vintage-first set list. */
  setIndex: number;
  /** Next card offset within current set. */
  cardOffset: number;
  /** Last set code being processed (debug). */
  setCode: string | null;
};

export type PokemonSetRow = {
  setCode: string;
  setName: string;
  releaseDate: string | null;
  cardCount: number | null;
};

export type NightlySetIngestPlan = {
  setCode: string;
  setName: string;
  releaseDate: string | null;
  cardCount: number | null;
  setIndex: number;
  cardOffset: number;
  catalogIds: string[];
  cardsThisRun: number;
  totalCardsInSet: number;
  setCompleteAfterRun: boolean;
  nextCursor: SetIngestCursor;
};

const DEFAULT_CURSOR: SetIngestCursor = { setIndex: 0, cardOffset: 0, setCode: null };

/** Pokémon sets ordered vintage → modern (oldest release_date first). */
export async function loadPokemonSetsVintageFirst(): Promise<PokemonSetRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabaseAdmin();
  const pageSize = 500;
  const rows: PokemonSetRow[] = [];

  for (let page = 0; page < 20; page += 1) {
    const { data, error } = await supabase
      .from("tcg_catalog_sets")
      .select("code,name,release_date,card_count")
      .eq("franchise", "pokemon")
      .order("release_date", { ascending: true, nullsFirst: false })
      .order("code", { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error || !data?.length) break;
    for (const row of data) {
      const setCode = String(row.code ?? "").trim();
      if (!setCode) continue;
      rows.push({
        setCode,
        setName: String(row.name ?? setCode),
        releaseDate: row.release_date ? String(row.release_date) : null,
        cardCount:
          typeof row.card_count === "number" && row.card_count > 0 ? row.card_count : null,
      });
    }
    if (data.length < pageSize) break;
  }

  return rows;
}

export async function readSetIngestCursor(): Promise<SetIngestCursor> {
  if (!isSupabaseConfigured()) return { ...DEFAULT_CURSOR };
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("tcg_catalog_sources")
    .select("raw_json")
    .eq("id", CURSOR_SOURCE_ID)
    .maybeSingle();
  const raw = (data?.raw_json as Record<string, unknown>) ?? {};
  const setIndex = Number(raw.marketIngestSetIndex);
  const cardOffset = Number(raw.marketIngestSetCardOffset);
  const setCode =
    typeof raw.marketIngestSetCode === "string" ? raw.marketIngestSetCode.trim() : null;
  return {
    setIndex: Number.isFinite(setIndex) && setIndex >= 0 ? Math.floor(setIndex) : 0,
    cardOffset: Number.isFinite(cardOffset) && cardOffset >= 0 ? Math.floor(cardOffset) : 0,
    setCode: setCode || null,
  };
}

export async function writeSetIngestCursor(cursor: SetIngestCursor): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("tcg_catalog_sources")
    .select("raw_json")
    .eq("id", CURSOR_SOURCE_ID)
    .maybeSingle();
  const prev = (data?.raw_json as Record<string, unknown>) ?? {};
  await supabase
    .from("tcg_catalog_sources")
    .update({
      raw_json: {
        ...prev,
        marketIngestSetIndex: cursor.setIndex,
        marketIngestSetCardOffset: cursor.cardOffset,
        marketIngestSetCode: cursor.setCode,
        marketIngestSetUpdatedAt: new Date().toISOString(),
      },
    })
    .eq("id", CURSOR_SOURCE_ID);
}

export async function loadSetCatalogIds(setCode: string): Promise<string[]> {
  if (!isSupabaseConfigured()) return [];
  const code = setCode.trim();
  if (!code) return [];

  const supabase = getSupabaseAdmin();
  const pageSize = 1000;
  const ids: string[] = [];

  for (let page = 0; page < 30; page += 1) {
    const { data, error } = await supabase
      .from("tcg_catalog_cards")
      .select("catalog_id")
      .eq("franchise", "pokemon")
      .eq("set_code", code)
      .order("card_number", { ascending: true, nullsFirst: false })
      .order("catalog_id", { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error || !data?.length) break;
    for (const row of data) {
      const id = String(row.catalog_id ?? "").trim();
      if (id) ids.push(id);
    }
    if (data.length < pageSize) break;
  }

  return ids;
}

/**
 * Plan the next nightly batch: one Pokémon set at a time, vintage → modern.
 * Advances card offset within the set; when the set is finished, moves to the next set.
 */
export async function planNightlySetIngest(options?: {
  maxCards?: number;
  setCodeOverride?: string | null;
  cursor?: SetIngestCursor;
}): Promise<NightlySetIngestPlan | null> {
  const maxCards = Math.max(1, options?.maxCards ?? 80);
  const sets = await loadPokemonSetsVintageFirst();
  if (!sets.length) return null;

  const cursor = options?.cursor ?? (await readSetIngestCursor());
  let setIndex = cursor.setIndex;
  let cardOffset = cursor.cardOffset;

  if (options?.setCodeOverride?.trim()) {
    const idx = sets.findIndex((s) => s.setCode === options.setCodeOverride!.trim());
    if (idx >= 0) {
      setIndex = idx;
      cardOffset = 0;
    }
  }

  if (setIndex >= sets.length) {
    setIndex = 0;
    cardOffset = 0;
  }

  const active = sets[setIndex]!;
  const catalogIds = await loadSetCatalogIds(active.setCode);

  if (catalogIds.length === 0) {
    const nextIndex = setIndex + 1 < sets.length ? setIndex + 1 : 0;
    const next = sets[nextIndex]!;
    return {
      setCode: next.setCode,
      setName: next.setName,
      releaseDate: next.releaseDate,
      cardCount: next.cardCount,
      setIndex: nextIndex,
      cardOffset: 0,
      catalogIds: [],
      cardsThisRun: 0,
      totalCardsInSet: 0,
      setCompleteAfterRun: true,
      nextCursor: { setIndex: nextIndex, cardOffset: 0, setCode: next.setCode },
    };
  }

  const slice = catalogIds.slice(cardOffset, cardOffset + maxCards);
  const nextOffset = cardOffset + slice.length;
  const setComplete = nextOffset >= catalogIds.length;

  const nextCursor: SetIngestCursor = setComplete
    ? {
        setIndex: setIndex + 1 < sets.length ? setIndex + 1 : 0,
        cardOffset: 0,
        setCode: setIndex + 1 < sets.length ? sets[setIndex + 1]!.setCode : sets[0]!.setCode,
      }
    : {
        setIndex,
        cardOffset: nextOffset,
        setCode: active.setCode,
      };

  return {
    setCode: active.setCode,
    setName: active.setName,
    releaseDate: active.releaseDate,
    cardCount: active.cardCount,
    setIndex,
    cardOffset,
    catalogIds: slice,
    cardsThisRun: slice.length,
    totalCardsInSet: catalogIds.length,
    setCompleteAfterRun: setComplete,
    nextCursor,
  };
}

/** Advance set cursor based on how many cards were actually ingested (handles time-budget early stop). */
export function resolveCursorAfterBatch(
  plan: NightlySetIngestPlan,
  processedCount: number,
): SetIngestCursor {
  const done = Math.max(0, Math.min(processedCount, plan.catalogIds.length));
  if (done === 0 && plan.catalogIds.length === 0) {
    return plan.nextCursor;
  }
  const newOffset = plan.cardOffset + done;
  const setFinished = newOffset >= plan.totalCardsInSet;
  if (setFinished) {
    return plan.nextCursor;
  }
  return {
    setIndex: plan.setIndex,
    cardOffset: newOffset,
    setCode: plan.setCode,
  };
}
