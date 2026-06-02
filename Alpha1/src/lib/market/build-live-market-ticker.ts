import type { CatalogSetSummary } from "@/lib/catalog/catalog-types";
import {
  bestCatalogUsd,
  hasParseableCatalogPrices,
} from "@/lib/market/catalog-price-utils";
import { parseCatalogPriceSnapshot } from "@/lib/market/catalog-reference-evidence";
import { resolvedCatalogMomentumPct } from "@/lib/market/poketrace/momentum";
import { tickerFmvFromIntel } from "@/lib/market/ticker-fmv";
import { refreshCatalogPricesFromTcgApi } from "@/lib/pgt-registry/catalog-intel-ingest";
import { readCatalogMarketIntel } from "@/lib/pgt-registry/pgt-market-intel-persist";
import {
  buildJpnArtworkTickerSlides,
  validateJpnArtworkTickerBuild,
} from "@/lib/market/build-jpn-artwork-ticker";
import { slideBannerPriceUsd, slideHasBannerData } from "@/lib/market/live-market-ticker-display";
import type {
  LiveMarketTickerLane,
  LiveMarketTickerLaneId,
  LiveMarketTickerPayload,
  LiveMarketTickerSlide,
} from "@/lib/market/live-market-ticker-types";
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

function rowToSlide(
  set: CatalogSetSummary,
  lane: LiveMarketTickerLaneId,
  row: TickerCardRow,
  priceUsd: number | null,
  priceLabel: string,
  momentumPct?: number | null,
  marketExtras?: {
    tcgMarketUsd?: number | null;
    rawFmvUsd?: number | null;
    psa10FmvUsd?: number | null;
  },
): LiveMarketTickerSlide {
  const displayUsd =
    marketExtras?.rawFmvUsd ?? priceUsd ?? marketExtras?.tcgMarketUsd ?? null;
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
    priceUsd: displayUsd != null ? Math.round(displayUsd * 100) / 100 : null,
    tcgMarketUsd:
      marketExtras?.tcgMarketUsd != null
        ? Math.round(marketExtras.tcgMarketUsd * 100) / 100
        : priceUsd != null
          ? Math.round(priceUsd * 100) / 100
          : null,
    rawFmvUsd: marketExtras?.rawFmvUsd ?? null,
    psa10FmvUsd: marketExtras?.psa10FmvUsd ?? null,
    momentumPct: momentumPct ?? null,
    priceLabel,
  };
}

async function marketExtrasForCatalogId(catalogId: string): Promise<{
  tcgMarketUsd: number | null;
  rawFmvUsd: number | null;
  psa10FmvUsd: number | null;
}> {
  const intel = await readCatalogMarketIntel(catalogId, { compLimit: 32 });
  const fmv = tickerFmvFromIntel(intel);
  return {
    tcgMarketUsd: null,
    rawFmvUsd: fmv.rawFmvUsd,
    psa10FmvUsd: fmv.psa10FmvUsd,
  };
}

function hydrateSlideFromCatalog(
  slide: LiveMarketTickerSlide,
  row: TickerCardRow,
): LiveMarketTickerSlide {
  const prices = parseCatalogPriceSnapshot(row.prices_json);
  const tcgMarketUsd = bestCatalogUsd(prices);
  const rawFmvUsd = tcgMarketUsd;
  const displayUsd = rawFmvUsd ?? slide.priceUsd;
  return {
    ...slide,
    priceUsd: displayUsd != null ? Math.round(displayUsd * 100) / 100 : slide.priceUsd,
    tcgMarketUsd,
    rawFmvUsd,
    priceLabel:
      slide.lane === "top_value" && rawFmvUsd != null
        ? "Top value · TCG ref"
        : slide.priceLabel,
  };
}

async function hydrateSlideMarket(
  slide: LiveMarketTickerSlide,
  row: TickerCardRow,
): Promise<LiveMarketTickerSlide> {
  const catalogFirst = hydrateSlideFromCatalog(slide, row);
  if (slide.lane !== "top_value") {
    return catalogFirst;
  }

  const extras = await marketExtrasForCatalogId(slide.catalogId);
  const tcgMarketUsd = catalogFirst.tcgMarketUsd ?? bestCatalogUsd(parseCatalogPriceSnapshot(row.prices_json));
  const rawFmvUsd = extras.rawFmvUsd ?? tcgMarketUsd;
  const displayUsd = rawFmvUsd ?? tcgMarketUsd ?? catalogFirst.priceUsd;
  return {
    ...catalogFirst,
    priceUsd: displayUsd != null ? Math.round(displayUsd * 100) / 100 : catalogFirst.priceUsd,
    rawFmvUsd,
    psa10FmvUsd: extras.psa10FmvUsd,
    priceLabel:
      extras.rawFmvUsd != null
        ? "Top value · Raw FMV"
        : tcgMarketUsd != null
          ? "Top value · TCG ref"
          : catalogFirst.priceLabel,
  };
}

export async function listPokemonSetsVintageFirst(): Promise<CatalogSetSummary[]> {
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

async function queryPricedCards(
  filter: { column: "set_code" | "set_name"; value: string },
): Promise<TickerCardRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("tcg_catalog_cards")
    .select(
      "catalog_id,name,card_number,rarity,image_small_url,image_large_url,prices_json",
    )
    .eq("franchise", "pokemon")
    .eq(filter.column, filter.value)
    .not("prices_json", "is", null)
    .limit(PRICED_CARD_LIMIT);
  if (error || !data?.length) return [];
  return data as TickerCardRow[];
}

async function fetchPricedCardsForSet(set: CatalogSetSummary): Promise<TickerCardRow[]> {
  const code = set.code?.trim();
  const name = set.name?.trim();
  const setId = set.id?.trim();
  const tried = new Set<string>();
  const candidates: Array<{ column: "set_code" | "set_name"; value: string }> = [];

  if (code) candidates.push({ column: "set_code", value: code });
  if (setId && setId !== code) candidates.push({ column: "set_code", value: setId });
  if (name) candidates.push({ column: "set_name", value: name });

  for (const filter of candidates) {
    const key = `${filter.column}:${filter.value}`;
    if (tried.has(key)) continue;
    tried.add(key);
    const rows = await queryPricedCards(filter);
    if (rows.length) return rows;
  }

  return [];
}

type SetInsights = {
  topValue: LiveMarketTickerSlide | null;
  momentum: LiveMarketTickerSlide | null;
  spotlight: LiveMarketTickerSlide | null;
};

async function insightsForSet(set: CatalogSetSummary): Promise<SetInsights> {
  let rows = await fetchPricedCardsForSet(set);
  if (!rows.length) return { topValue: null, momentum: null, spotlight: null };

  const anyPriced = rows.some((row) => hasParseableCatalogPrices(row.prices_json));
  if (!anyPriced && rows[0]?.catalog_id) {
    await refreshCatalogPricesFromTcgApi(rows[0].catalog_id).catch(() => false);
    rows = await fetchPricedCardsForSet(set);
  }

  const scored: {
    row: TickerCardRow;
    price: number | null;
    momentum: number | null;
  }[] = [];

  for (const row of rows) {
    if (!hasParseableCatalogPrices(row.prices_json)) continue;
    const prices = parseCatalogPriceSnapshot(row.prices_json);
    scored.push({
      row,
      price: bestCatalogUsd(prices),
      momentum: resolvedCatalogMomentumPct(prices),
    });
  }

  const hasImage = (row: TickerCardRow) =>
    Boolean(row.image_large_url?.trim() || row.image_small_url?.trim());

  const priced = scored
    .filter((s) => s.price != null && (s.price ?? 0) > 0)
    .sort((a, b) => {
      const priceDiff = (b.price ?? 0) - (a.price ?? 0);
      if (priceDiff !== 0) return priceDiff;
      return Number(hasImage(b.row)) - Number(hasImage(a.row));
    });

  let topValue =
    priced[0] != null
      ? rowToSlide(set, "top_value", priced[0].row, priced[0].price, "Top value · TCG ref")
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
          ? "7d Cardmarket trend"
          : "Raw FMV",
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
          ? "PSA 10 FMV"
          : "Set highlight",
        spotlightSource.momentum,
      )
    : null;

  if (topValue && priced[0]) {
    topValue = await hydrateSlideMarket(topValue, priced[0].row);
    if (!slideHasBannerData(topValue)) {
      const runner = priced.find(
        (p, i) => i > 0 && hasImage(p.row) && (p.price ?? 0) > 0,
      );
      if (runner) {
        topValue = await hydrateSlideMarket(
          rowToSlide(set, "top_value", runner.row, runner.price, "Top value · TCG ref"),
          runner.row,
        );
      } else {
        topValue = null;
      }
    }
  }

  const momentumHydrated =
    momentum && momentumCandidate?.row
      ? hydrateSlideFromCatalog(momentum, momentumCandidate.row)
      : momentum;
  const spotlightHydrated =
    spotlight && spotlightSource?.row
      ? hydrateSlideFromCatalog(spotlight, spotlightSource.row)
      : spotlight;

  return {
    topValue: topValue && slideHasBannerData(topValue) ? topValue : null,
    momentum: momentumHydrated,
    spotlight: spotlightHydrated,
  };
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
    if (row.topValue && slideHasBannerData(row.topValue)) {
      topValueSlides.push({
        ...row.topValue,
        priceUsd: slideBannerPriceUsd(row.topValue) ?? row.topValue.priceUsd,
      });
    }
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
      subtitle: "Highest-priced card per set · core market pulse",
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

    const topValueCount = lanes.find((l) => l.id === "top_value")?.slides.length ?? 0;

    return {
      ready: topValueCount > 0 || slides.length > 0,
      lanes,
      slides,
      setCount: sets.length,
      topValueCount,
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
