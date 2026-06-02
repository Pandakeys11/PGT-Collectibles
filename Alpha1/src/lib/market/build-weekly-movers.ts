import { loadSetCardsForCatalogInsight } from "@/lib/catalog/build-catalog-set-insight";
import { resolveSetRecord } from "@/lib/catalog/db-catalog-browse";
import {
  cardInsightRow,
  topMomentumCards,
  type SetInsightCardSource,
} from "@/lib/catalog/set-insight-utils";
import { listPokemonSetsVintageFirst } from "@/lib/market/build-live-market-ticker";
import { resolveCatalogMomentum } from "@/lib/market/catalog-momentum";
import { hasParseableCatalogPrices, moverDisplayUsd } from "@/lib/market/catalog-price-utils";
import { parseCatalogPriceSnapshot } from "@/lib/market/catalog-reference-evidence";
import { hydrateSetUsMomentum } from "@/lib/market/hydrate-catalog-momentum";
import type {
  MoversSignalKind,
  WeeklyMoverCard,
  WeeklyMoversPayload,
} from "@/lib/market/weekly-movers-types";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";

export type { MoversSignalKind, WeeklyMoverCard, WeeklyMoversPayload } from "@/lib/market/weekly-movers-types";
export { moversSignalSubtitle } from "@/lib/market/weekly-movers-types";

const SET_LIMIT = 48;
const MIN_ABS_MOMENTUM = 3;
import {
  SET_INSIGHT_MOVER_SEED_LIMIT,
  SET_MOVER_COLUMN_SIZE,
} from "@/lib/catalog/set-insight-limits";

export {
  SET_INSIGHT_MOVER_SEED_LIMIT,
  SET_MOVER_COLUMN_SIZE,
} from "@/lib/catalog/set-insight-limits";

const LIST_SIZE = 6;

type CardRow = {
  catalog_id: string;
  name: string;
  set_name: string | null;
  set_code: string | null;
  card_number: string | null;
  rarity: string | null;
  image_small_url: string | null;
  image_large_url: string | null;
  prices_json: Record<string, unknown> | null;
};

export async function moversForSetCode(
  setCode: string,
  setName: string,
): Promise<WeeklyMoverCard[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("tcg_catalog_cards")
    .select(
      "catalog_id,name,set_name,set_code,card_number,rarity,image_small_url,image_large_url,prices_json",
    )
    .eq("franchise", "pokemon")
    .eq("set_code", setCode)
    .limit(280);

  const rows = (data ?? []) as CardRow[];
  const out: WeeklyMoverCard[] = [];

  for (const row of rows) {
    if (!hasParseableCatalogPrices(row.prices_json)) continue;
    const prices = parseCatalogPriceSnapshot(row.prices_json);
    const mom = resolveCatalogMomentum(prices);
    if (mom.pct == null || Math.abs(mom.pct) < MIN_ABS_MOMENTUM) continue;
    const priceUsd = moverDisplayUsd(prices);

    out.push({
      catalogId: row.catalog_id,
      name: row.name,
      setName,
      setCode: row.set_code,
      cardNumber: row.card_number,
      rarity: row.rarity,
      imageUrl: row.image_large_url ?? row.image_small_url,
      priceUsd,
      priceLabel: priceUsd != null ? "TCGPlayer market" : null,
      momentumPct: mom.pct,
      momentumLabel: mom.label,
      momentumRegion: mom.region,
      deltaUsd: mom.deltaUsd,
    });
  }

  return out;
}

function insightRowToMover(row: ReturnType<typeof cardInsightRow>, setName: string): WeeklyMoverCard {
  return {
    catalogId: row.catalogId,
    name: row.name,
    setName,
    setCode: null,
    cardNumber: row.number,
    rarity: row.rarity,
    imageUrl: row.imageUrl,
    priceUsd: row.priceUsd,
    priceLabel: row.priceLabel ?? null,
    momentumPct: row.momentumPct ?? 0,
    momentumLabel: row.momentumLabel ?? null,
    momentumRegion: row.momentumRegion ?? null,
    deltaUsd: row.momentumDeltaUsd ?? null,
  };
}

function moversFromInsightCards(
  cards: SetInsightCardSource[],
  setName: string,
  poolLimit = SET_INSIGHT_MOVER_SEED_LIMIT,
): WeeklyMoverCard[] {
  return topMomentumCards(cards, poolLimit).map((row) => insightRowToMover(row, setName));
}

function countMomentumRegions(pool: WeeklyMoverCard[]): { us: number; eu: number } {
  let us = 0;
  let eu = 0;
  for (const row of pool) {
    if (row.momentumRegion === "us") us += 1;
    else if (row.momentumRegion === "eu") eu += 1;
  }
  return { us, eu };
}

function splitMovers(
  pool: WeeklyMoverCard[],
  columnSize = LIST_SIZE,
): Pick<WeeklyMoversPayload, "increases" | "decreases"> {
  const increases = pool
    .filter((c) => c.momentumPct > 0)
    .sort((a, b) => b.momentumPct - a.momentumPct)
    .slice(0, columnSize);
  const decreases = pool
    .filter((c) => c.momentumPct < 0)
    .sort((a, b) => a.momentumPct - b.momentumPct)
    .slice(0, columnSize);
  return { increases, decreases };
}

/** Top 7-day movers for one master-catalog set (updates when `setId` changes). */
export async function buildSetMovers(
  setId: string,
  setNameHint?: string | null,
): Promise<WeeklyMoversPayload & { setId: string; setName: string }> {
  const refreshedAt = new Date().toISOString();
  const needle = setId.trim();
  if (!needle) {
    return {
      setId: "",
      setName: "",
      ready: false,
      refreshedAt,
      increases: [],
      decreases: [],
      error: "set_id_required",
    };
  }

  try {
    const record = isSupabaseConfigured()
      ? await resolveSetRecord("pokemon", needle)
      : null;
    const setName = record?.name ?? setNameHint ?? needle;

    // Same full-set + live TCG enrichment as set insight (not DB set_code scan alone).
    let { cards } = await loadSetCardsForCatalogInsight(needle);
    if (process.env.CATALOG_MOMENTUM_HYDRATE !== "0") {
      cards = await hydrateSetUsMomentum(cards);
    }
    const pool = cards.length > 0 ? moversFromInsightCards(cards, setName) : [];
    const regions = countMomentumRegions(pool);
    const hasStrong = pool.some((r) => Math.abs(r.momentumPct) >= MIN_ABS_MOMENTUM);
    const signalKind: MoversSignalKind =
      pool.length === 0 ? "none" : hasStrong ? "strong" : "weak";

    let { increases, decreases } = splitMovers(pool, SET_MOVER_COLUMN_SIZE);
    if (increases.length === 0 && decreases.length === 0 && pool.length > 0) {
      const ups = pool.filter((r) => r.momentumPct > 0).slice(0, SET_MOVER_COLUMN_SIZE);
      const downs = pool.filter((r) => r.momentumPct < 0).slice(0, SET_MOVER_COLUMN_SIZE);
      increases = ups;
      decreases = downs;
    }

    return {
      setId: needle,
      setName,
      ready: increases.length > 0 || decreases.length > 0,
      refreshedAt,
      increases,
      decreases,
      momentumUsCount: regions.us,
      momentumEuCount: regions.eu,
      signalKind,
    };
  } catch (e) {
    return {
      setId: needle,
      setName: setNameHint ?? needle,
      ready: false,
      refreshedAt,
      increases: [],
      decreases: [],
      error: e instanceof Error ? e.message : "build_failed",
    };
  }
}

export async function buildWeeklyMovers(): Promise<WeeklyMoversPayload> {
  const refreshedAt = new Date().toISOString();

  if (!isSupabaseConfigured()) {
    return {
      ready: false,
      refreshedAt,
      increases: [],
      decreases: [],
      error: "no_database",
    };
  }

  try {
    const sets = (await listPokemonSetsVintageFirst()).slice(0, SET_LIMIT);
    const pool: WeeklyMoverCard[] = [];

    for (const set of sets) {
      const code = set.code?.trim() || set.id;
      const batch = await moversForSetCode(code, set.name);
      pool.push(...batch);
    }

    const { increases, decreases } = splitMovers(pool);

    return {
      ready: increases.length > 0 || decreases.length > 0,
      refreshedAt,
      increases,
      decreases,
    };
  } catch (e) {
    return {
      ready: false,
      refreshedAt,
      increases: [],
      decreases: [],
      error: e instanceof Error ? e.message : "build_failed",
    };
  }
}
