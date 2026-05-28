import type { CatalogSetSummary } from "@/lib/catalog/catalog-types";
import { parseCatalogPriceSnapshot } from "@/lib/market/catalog-reference-evidence";
import { catalogMomentumPct } from "@/lib/catalog/set-insight-utils";
import {
  buildJpnArtworkTickerSlides,
  validateJpnArtworkTickerBuild,
} from "@/lib/market/build-jpn-artwork-ticker";
import type {
  LiveMarketTickerLane,
  LiveMarketTickerLaneId,
  LiveMarketTickerPayload,
  LiveMarketTickerSlide,
} from "@/lib/market/live-market-ticker-types";
import type { CatalogPriceSnapshot } from "@/lib/market/pokemon-catalog";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";

const SET_CONCURRENCY = 10;
const PRICED_CARD_LIMIT = 350;

type TickerCardRow = {
  catalog_id: string;
  name: string;
  card_number: string | null;
  rarity: string | null;
  image_small_url: string | null;
  image_large_url: string | null;
  prices_json: Record<string, unknown> | null;
};

function setVisibilityFilter(): string {
  const today = new Date().toISOString().slice(0, 10);
  return `release_date.lte.${today},release_date.is.null,card_count.gt.0,card_count.is.null`;
}

function bestTcgUsd(prices: CatalogPriceSnapshot): number | null {
  let best: number | null = null;
  for (const row of prices.tcgPlayerPrices) {
    const n = row.market ?? row.mid ?? row.low;
    if (n == null || !Number.isFinite(n)) continue;
    if (best == null || n > best) best = n;
  }
  return best;
}

function bestCatalogUsd(prices: CatalogPriceSnapshot): { usd: number | null; label: string } {
  const tcg = bestTcgUsd(prices);
  if (tcg != null) return { usd: tcg, label: "TCGPlayer market" };
  const cm = prices.cardMarket;
  const cmUsd = cm?.trendPrice ?? cm?.averageSellPrice ?? cm?.avg30 ?? cm?.avg7 ?? cm?.lowPrice ?? null;
  if (cmUsd != null && Number.isFinite(cmUsd)) {
    return { usd: cmUsd, label: "Cardmarket trend" };
  }
  return { usd: null, label: "Market reference" };
}

function rowToSlide(
  set: CatalogSetSummary,
  lane: LiveMarketTickerLaneId,
  row: TickerCardRow,
  priceUsd: number | null,
  priceLabel: string,
  momentumPct?: number | null,
): LiveMarketTickerSlide {
  return {
    lane,
    setId: set.id,
    setName: set.name,
    setCode: set.code,
    releaseYear: set.year,
    catalogId: row.catalog_id,
    cardName: row.name,
    cardNumber: row.card_number,
    rarity: row.rarity,
    imageUrl: row.image_large_url ?? row.image_small_url ?? null,
    priceUsd: priceUsd != null ? Math.round(priceUsd * 100) / 100 : null,
    momentumPct: momentumPct ?? null,
    priceLabel,
  };
}

async function listPokemonSetsVintageFirst(): Promise<CatalogSetSummary[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabaseAdmin();
  const pageSize = 100;
  const out: CatalogSetSummary[] = [];
  let page = 0;

  for (;;) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("tcg_catalog_sets")
      .select("external_set_id,name,code,release_date,card_count,raw_json")
      .eq("franchise", "pokemon")
      .or(setVisibilityFilter())
      .order("release_date", { ascending: true, nullsFirst: true })
      .range(from, to);

    if (error || !data?.length) break;

    for (const row of data) {
      const releaseDate = row.release_date ? String(row.release_date) : null;
      const raw = (row.raw_json ?? {}) as Record<string, unknown>;
      const images = raw.images as { symbol?: string; logo?: string } | undefined;
      out.push({
        id: String(row.external_set_id),
        name: String(row.name),
        code: row.code ? String(row.code) : null,
        series: typeof raw.series === "string" ? raw.series : null,
        releaseDate,
        year: releaseDate?.slice(0, 4) ?? null,
        printedTotal: typeof row.card_count === "number" ? row.card_count : null,
        total: typeof row.card_count === "number" ? row.card_count : null,
        images,
        franchise: "pokemon",
      });
    }

    if (data.length < pageSize) break;
    page += 1;
  }

  return out;
}

async function fetchPricedCardsForSet(set: CatalogSetSummary): Promise<TickerCardRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabaseAdmin();
  const code = set.code?.trim();
  const name = set.name?.trim();

  let query = supabase
    .from("tcg_catalog_cards")
    .select(
      "catalog_id,name,card_number,rarity,image_small_url,image_large_url,prices_json",
    )
    .eq("franchise", "pokemon")
    .not("prices_json", "is", null)
    .limit(PRICED_CARD_LIMIT);

  if (code) {
    query = query.eq("set_code", code);
  } else if (name) {
    query = query.eq("set_name", name);
  } else {
    return [];
  }

  const { data, error } = await query;
  if (error || !data?.length) {
    if (code && name) {
      const fallback = await supabase
        .from("tcg_catalog_cards")
        .select(
          "catalog_id,name,card_number,rarity,image_small_url,image_large_url,prices_json",
        )
        .eq("franchise", "pokemon")
        .eq("set_name", name)
        .not("prices_json", "is", null)
        .limit(PRICED_CARD_LIMIT);
      return (fallback.data ?? []) as TickerCardRow[];
    }
    return [];
  }
  return data as TickerCardRow[];
}

type SetInsights = {
  topValue: LiveMarketTickerSlide | null;
  momentum: LiveMarketTickerSlide | null;
  spotlight: LiveMarketTickerSlide | null;
};

async function insightsForSet(set: CatalogSetSummary): Promise<SetInsights> {
  const rows = await fetchPricedCardsForSet(set);
  if (!rows.length) return { topValue: null, momentum: null, spotlight: null };

  const scored: {
    row: TickerCardRow;
    price: number | null;
    priceLabel: string;
    momentum: number | null;
  }[] = [];

  for (const row of rows) {
    const prices = parseCatalogPriceSnapshot(row.prices_json);
    const best = bestCatalogUsd(prices);
    scored.push({
      row,
      price: best.usd,
      priceLabel: best.label,
      momentum: catalogMomentumPct(prices),
    });
  }

  const priced = scored
    .filter((s) => s.price != null)
    .sort((a, b) => (b.price ?? 0) - (a.price ?? 0));

  const topValue =
    priced[0] != null
      ? rowToSlide(set, "top_value", priced[0].row, priced[0].price, priced[0].priceLabel)
      : rows[0]
        ? rowToSlide(set, "top_value", rows[0], null, "TCGPlayer reference")
        : null;

  const topCatalogId = priced[0]?.row.catalog_id ?? null;

  const momentumCandidate =
    scored
      .filter((s) => s.momentum != null && Math.abs(s.momentum!) >= 1)
      .sort((a, b) => Math.abs(b.momentum ?? 0) - Math.abs(a.momentum ?? 0))[0] ??
    scored
      .filter((s) => s.row.catalog_id !== topCatalogId)
      .sort((a, b) => Math.abs(b.momentum ?? 0) - Math.abs(a.momentum ?? 0))[0] ??
    priced[1] ??
    priced[2] ??
    null;

  const momentum = momentumCandidate
    ? rowToSlide(
        set,
        "momentum",
        momentumCandidate.row,
        momentumCandidate.price,
        momentumCandidate.momentum != null && Math.abs(momentumCandidate.momentum) >= 1
          ? "Cardmarket trend vs 7d avg"
          : momentumCandidate.priceLabel,
        momentumCandidate.momentum,
      )
    : null;

  const spotlightSource =
    priced.find((p) => p.row.catalog_id !== topCatalogId) ??
    scored.find((s) => s.row.catalog_id !== topCatalogId) ??
    priced[1] ??
    null;

  const spotlight = spotlightSource
    ? rowToSlide(
        set,
        "spotlight",
        spotlightSource.row,
        spotlightSource.price,
        spotlightSource.row.catalog_id !== topCatalogId
          ? spotlightSource.priceLabel
          : "Set highlight",
        spotlightSource.momentum,
      )
    : null;

  return { topValue, momentum, spotlight };
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    for (;;) {
      const idx = next++;
      if (idx >= items.length) break;
      results[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, Math.max(1, items.length)) }, () => worker()),
  );
  return results;
}

function buildLanes(
  insights: SetInsights[],
  jpnSlides: LiveMarketTickerSlide[],
): { lanes: LiveMarketTickerLane[]; slides: LiveMarketTickerSlide[] } {
  const topValueSlides: LiveMarketTickerSlide[] = [];
  const momentumSlides: LiveMarketTickerSlide[] = [];
  const spotlightSlides: LiveMarketTickerSlide[] = [];

  for (const row of insights) {
    const topId = row.topValue?.catalogId ?? null;
    if (row.topValue) topValueSlides.push(row.topValue);
    if (row.momentum && row.momentum.catalogId !== topId) {
      momentumSlides.push(row.momentum);
    } else if (row.spotlight && row.spotlight.catalogId !== topId) {
      momentumSlides.push({ ...row.spotlight, lane: "momentum", priceLabel: "Alt market signal" });
    }
    if (row.spotlight && row.spotlight.catalogId !== topId) {
      spotlightSlides.push(row.spotlight);
    } else if (row.momentum && row.momentum.catalogId !== topId) {
      spotlightSlides.push({ ...row.momentum, lane: "spotlight", priceLabel: "Momentum spotlight" });
    }
  }

  const lanes: LiveMarketTickerLane[] = [
    {
      id: "top_value",
      label: "Top value",
      subtitle: "Highest TCGPlayer market per set",
      slides: topValueSlides,
    },
    {
      id: "momentum",
      label: "Price momentum",
      subtitle: "Cardmarket trend vs 7-day avg",
      slides: momentumSlides,
    },
    {
      id: "jpn_art",
      label: "Japanese art",
      subtitle: "Validated JPN print · vintage → modern",
      slides: jpnSlides,
    },
    {
      id: "spotlight",
      label: "Set spotlight",
      subtitle: "Runner-up value & highlights",
      slides: spotlightSlides,
    },
  ];

  const slides: LiveMarketTickerSlide[] = [];
  const maxLen = Math.max(...lanes.map((l) => l.slides.length), 0);
  for (let i = 0; i < maxLen; i += 1) {
    for (const lane of lanes) {
      const slide = lane.slides[i];
      if (slide) slides.push(slide);
    }
  }

  return { lanes, slides };
}

export async function buildLiveMarketTicker(): Promise<LiveMarketTickerPayload> {
  const refreshedAt = new Date().toISOString();

  try {
    if (!isSupabaseConfigured()) {
      return { ready: false, lanes: [], slides: [], setCount: 0, refreshedAt, error: "no_database" };
    }

    const sets = await listPokemonSetsVintageFirst();
    if (sets.length === 0) {
      return { ready: false, lanes: [], slides: [], setCount: 0, refreshedAt, error: "no_sets" };
    }

    const [insights, jpnSlides] = await Promise.all([
      mapPool(sets, SET_CONCURRENCY, insightsForSet),
      buildJpnArtworkTickerSlides(),
    ]);
    const { lanes, slides } = buildLanes(insights, jpnSlides);

    const jpnValidation = await validateJpnArtworkTickerBuild(
      lanes.find((l) => l.id === "jpn_art")?.slides ?? [],
    );
    if (jpnSlides.length > 0 && !jpnValidation.ok) {
      console.warn("[live-ticker] JPN artwork validation:", jpnValidation.issues.join(", "));
    }

    return {
      ready: slides.length > 0,
      lanes,
      slides,
      setCount: sets.length,
      refreshedAt,
    };
  } catch (e) {
    return {
      ready: false,
      lanes: [],
      slides: [],
      setCount: 0,
      refreshedAt,
      error: e instanceof Error ? e.message : "build_failed",
    };
  }
}
