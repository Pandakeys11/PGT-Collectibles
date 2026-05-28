import { loadSetCardsForCatalogInsight } from "@/lib/catalog/build-catalog-set-insight";
import { resolveSetRecord } from "@/lib/catalog/db-catalog-browse";
import { topMomentumCards, type SetInsightCardSource } from "@/lib/catalog/set-insight-utils";
import { listPokemonSetsVintageFirst } from "@/lib/market/build-live-market-ticker";
import { bestCatalogUsd, hasParseableCatalogPrices } from "@/lib/market/catalog-price-utils";
import { parseCatalogPriceSnapshot } from "@/lib/market/catalog-reference-evidence";
import { resolvedCatalogMomentumPct } from "@/lib/market/poketrace/momentum";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";

export type WeeklyMoverCard = {
  catalogId: string;
  name: string;
  setName: string;
  setCode: string | null;
  cardNumber: string | null;
  rarity: string | null;
  imageUrl: string | null;
  priceUsd: number | null;
  momentumPct: number;
  deltaUsd: number | null;
};

export type WeeklyMoversPayload = {
  ready: boolean;
  refreshedAt: string;
  increases: WeeklyMoverCard[];
  decreases: WeeklyMoverCard[];
  error?: string | null;
};

const SET_LIMIT = 48;
const MIN_ABS_MOMENTUM = 3;
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
    const momentum = resolvedCatalogMomentumPct(row.prices_json);
    if (momentum == null || Math.abs(momentum) < MIN_ABS_MOMENTUM) continue;
    const prices = parseCatalogPriceSnapshot(row.prices_json);
    const priceUsd = bestCatalogUsd(prices);
    const cm = prices.cardMarket;
    const deltaUsd =
      cm?.trendPrice != null && cm.avg7 != null
        ? Math.round((cm.trendPrice - cm.avg7) * 100) / 100
        : null;

    out.push({
      catalogId: row.catalog_id,
      name: row.name,
      setName,
      setCode: row.set_code,
      cardNumber: row.card_number,
      rarity: row.rarity,
      imageUrl: row.image_large_url ?? row.image_small_url,
      priceUsd,
      momentumPct: momentum,
      deltaUsd,
    });
  }

  return out;
}

function moversFromInsightCards(
  cards: SetInsightCardSource[],
  setName: string,
): WeeklyMoverCard[] {
  return topMomentumCards(cards, 24).map((row) => ({
    catalogId: row.catalogId,
    name: row.name,
    setName,
    setCode: null,
    cardNumber: row.number,
    rarity: row.rarity,
    imageUrl: row.imageUrl,
    priceUsd: row.priceUsd,
    momentumPct: row.momentumPct ?? 0,
    deltaUsd: null,
  }));
}

function splitMovers(pool: WeeklyMoverCard[]): Pick<WeeklyMoversPayload, "increases" | "decreases"> {
  const increases = pool
    .filter((c) => c.momentumPct > 0)
    .sort((a, b) => b.momentumPct - a.momentumPct)
    .slice(0, LIST_SIZE);
  const decreases = pool
    .filter((c) => c.momentumPct < 0)
    .sort((a, b) => a.momentumPct - b.momentumPct)
    .slice(0, LIST_SIZE);
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
    const { cards } = await loadSetCardsForCatalogInsight(needle);
    const pool = cards.length > 0 ? moversFromInsightCards(cards, setName) : [];

    const { increases, decreases } = splitMovers(pool);
    return {
      setId: needle,
      setName,
      ready: increases.length > 0 || decreases.length > 0,
      refreshedAt,
      increases,
      decreases,
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
