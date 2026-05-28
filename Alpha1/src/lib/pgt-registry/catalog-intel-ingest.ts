import { getCardFromDb } from "@/lib/catalog/db-catalog-browse";
import { upsertCatalogCards } from "@/lib/catalog/db-catalog";
import { parseCatalogPriceSnapshot } from "@/lib/market/catalog-reference-evidence";
import { priceChartingUsdFromEvidence } from "@/lib/market/catalog-raw-fmv";
import { inferEvidenceGradeBucket } from "@/lib/market/market-intelligence";
import { isPokeTraceConfigured, isPokeTracePrimary } from "@/lib/market/env-market";
import { refreshPokeTraceCatalogPrices } from "@/lib/market/poketrace/sync-catalog";
import { researchCardMarket } from "@/lib/market/research";
import { catalogSummaryToExtractedCard } from "@/lib/market/pokemon-market-knowledge";
import { fetchPokemonCardById } from "@/lib/pokedex/tcg-api-server";
import { isBrightDataPopHarvestEnabled } from "@/lib/market/brightdata/config";
import { harvestGraderPopForCatalogCard } from "@/lib/pgt-registry/grader-pop-ingest";
import { persistMarketIntelFromEnrich } from "@/lib/pgt-registry/pgt-market-intel-persist";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import type { MarketEvidence } from "@/lib/scan/schemas";

const POP_COOLDOWN_MS = 24 * 60 * 60 * 1000;

const GRADE_POP_TARGETS: Array<{ grader: string; grade: string; bucket: string }> = [
  { grader: "PSA", grade: "10", bucket: "psa10" },
  { grader: "PSA", grade: "9", bucket: "psa9" },
  { grader: "BGS", grade: "10 Black Label", bucket: "bgsBlackLabel" },
  { grader: "CGC", grade: "10 Pristine", bucket: "cgcPristine10" },
  { grader: "PGT", grade: "Raw", bucket: "raw" },
];

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function priceSnapshotFromApiCard(card: {
  tcgplayer?: {
    url?: string;
    updatedAt?: string;
    prices?: Record<string, { market?: number; mid?: number; low?: number; high?: number }>;
  };
  cardmarket?: {
    url?: string;
    updatedAt?: string;
    prices?: {
      averageSellPrice?: number;
      trendPrice?: number;
      lowPrice?: number;
      avg7?: number;
      avg30?: number;
      reverseHoloTrend?: number;
    };
  };
}): Record<string, unknown> {
  const tp = card.tcgplayer;
  const tcgPlayerPrices = tp?.prices
    ? Object.entries(tp.prices).map(([variant, block]) => ({
        variant,
        market: block.market ?? null,
        mid: block.mid ?? null,
        low: block.low ?? null,
        high: block.high ?? null,
        directLow: null,
      }))
    : [];

  const cm = card.cardmarket?.prices;
  const cardMarket = cm
    ? {
        averageSellPrice: asNumber(cm.averageSellPrice),
        trendPrice: asNumber(cm.trendPrice),
        lowPrice: asNumber(cm.lowPrice),
        avg7: asNumber(cm.avg7),
        avg30: asNumber(cm.avg30),
        reverseHoloTrend: asNumber(cm.reverseHoloTrend),
      }
    : null;

  return {
    tcgPlayerUrl: tp?.url ?? null,
    tcgPlayerUpdatedAt: tp?.updatedAt ?? null,
    tcgPlayerPrices,
    cardMarketUrl: card.cardmarket?.url ?? null,
    cardMarketUpdatedAt: card.cardmarket?.updatedAt ?? null,
    cardMarket,
  };
}

/** Refresh `tcg_catalog_cards.prices_json` from Pokémon TCG API when we have a pokemonId. */
export async function refreshCatalogPricesFromTcgApi(catalogId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const card = await getCardFromDb("pokemon", catalogId);
  if (!card) return false;

  const pokemonId =
    card.sourceCatalogId ??
    (card as { id?: string }).id ??
    catalogId;

  const apiCard = await fetchPokemonCardById(pokemonId, { cache: "no-store" });
  if (!apiCard?.tcgplayer?.prices && !apiCard?.cardmarket?.prices) return false;

  const pricesJson = priceSnapshotFromApiCard(apiCard);
  await upsertCatalogCards([
    {
      franchise: "pokemon",
      catalogId,
      name: card.name,
      printedName: card.name,
      setName: card.set?.name ?? null,
      setCode: card.set?.code ?? null,
      cardNumber: card.number,
      year: card.set?.releaseDate?.slice(0, 4) ?? null,
      rarity: card.rarity,
      imageSmallUrl: card.images?.small ?? null,
      imageLargeUrl: card.images?.large ?? null,
      pricesJson,
      rawJson: { pokemonId, catalogVariantKey: card.catalogVariantKey },
      sourceId: "pokemontcg.io",
    },
  ]);
  return true;
}

/** Cache PriceCharting loose guide on the card row for instant RAW FMV in catalog UI. */
async function persistPriceChartingOnCatalogCard(
  catalogId: string,
  evidence: MarketEvidence[],
): Promise<void> {
  const pcUsd = priceChartingUsdFromEvidence(evidence);
  if (pcUsd == null || !isSupabaseConfigured()) return;

  const card = await getCardFromDb("pokemon", catalogId);
  if (!card) return;

  const snap = card.prices ?? parseCatalogPriceSnapshot(null);
  const pcRow = evidence.find((e) => e.source === "PriceCharting" && e.url);
  const pricesJson = {
    tcgPlayerUrl: snap.tcgPlayerUrl,
    tcgPlayerUpdatedAt: snap.tcgPlayerUpdatedAt,
    tcgPlayerPrices: snap.tcgPlayerPrices,
    cardMarketUrl: snap.cardMarketUrl,
    cardMarketUpdatedAt: snap.cardMarketUpdatedAt,
    cardMarket: snap.cardMarket,
    priceChartingLooseUsd: pcUsd,
    priceChartingUrl: pcRow?.url ?? snap.priceChartingUrl,
    priceChartingUpdatedAt: new Date().toISOString().slice(0, 10),
  };

  await upsertCatalogCards([
    {
      franchise: "pokemon",
      catalogId,
      name: card.name,
      printedName: card.name,
      setName: card.set?.name ?? null,
      setCode: card.set?.code ?? null,
      cardNumber: card.number,
      year: card.set?.releaseDate?.slice(0, 4) ?? null,
      rarity: card.rarity,
      imageSmallUrl: card.images?.small ?? null,
      imageLargeUrl: card.images?.large ?? null,
      pricesJson,
      rawJson: { catalogVariantKey: card.catalogVariantKey },
      sourceId: "pgt_market_ingest",
    },
  ]);
}

/**
 * PGT population snapshots from market comps (liquidity proxy until official PSA pop per card is wired).
 * Also records sold-comp counts per grade bucket for FMV dashboards.
 */
export async function persistCatalogPopulationFromMarketEvidence(
  catalogId: string,
  evidence: MarketEvidence[],
): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  const id = catalogId.trim();
  if (!id) return 0;

  const supabase = getSupabaseAdmin();
  const since = new Date(Date.now() - POP_COOLDOWN_MS).toISOString();
  let written = 0;

  for (const target of GRADE_POP_TARGETS) {
    const rows = evidence.filter((ev) => inferEvidenceGradeBucket(ev) === target.bucket);
    const sold = rows.filter((ev) => ev.kind === "sold" && ev.priceUsd != null);
    if (sold.length === 0 && target.bucket !== "raw") continue;

    const { data: recent } = await supabase
      .from("pgt_population_snapshots")
      .select("id")
      .eq("catalog_id", id)
      .eq("grader", target.grader)
      .eq("grade", target.grade)
      .gte("captured_at", since)
      .limit(1);
    if (recent?.length) continue;

    const prices = sold.map((ev) => ev.priceUsd as number).sort((a, b) => a - b);
    const median = prices.length
      ? prices[Math.floor(prices.length / 2)]
      : null;

    const { error } = await supabase.from("pgt_population_snapshots").insert({
      catalog_id: id,
      franchise: "pokemon",
      grader: target.grader,
      grade: target.grade,
      population_count: sold.length,
      population_higher: rows.filter((ev) => ev.kind === "active").length,
      population_note:
        target.grader === "PGT"
          ? `PGT market liquidity: ${sold.length} sold / ${rows.length} total comps in ingest (not official grader pop). Median sold $${median ?? "—"}.`
          : `PGT comp-derived liquidity: ${sold.length} sold rows tagged ${target.grade} (official ${target.grader} pop requires cert or set-level PSA report).`,
      source: "pgt_market_ingest",
      captured_at: new Date().toISOString(),
    });
    if (!error) written += 1;
  }

  return written;
}

export type CatalogIntelIngestResult = {
  catalogId: string;
  ok: boolean;
  comps: number;
  popSnapshots: number;
  graderPopSnapshots: number;
  pricesRefreshed: boolean;
  institutionalMemory: boolean;
  error?: string;
};

/** Per-card ingest: prices refresh + market research + comps + pop snapshots. */
export async function ingestCatalogMarketIntel(
  catalogId: string,
  options?: { profile?: "nightly" | "full" },
): Promise<CatalogIntelIngestResult> {
  const profile = options?.profile ?? "full";
  const id = catalogId.trim();
  if (!id) {
    return {
      catalogId: id,
      ok: false,
      comps: 0,
      popSnapshots: 0,
      graderPopSnapshots: 0,
      pricesRefreshed: false,
      institutionalMemory: false,
      error: "missing_id",
    };
  }

  try {
    const catalogCard = await getCardFromDb("pokemon", id);
    if (!catalogCard) {
      return {
        catalogId: id,
        ok: false,
        comps: 0,
        popSnapshots: 0,
        graderPopSnapshots: 0,
        pricesRefreshed: false,
        institutionalMemory: false,
        error: "not_in_catalog",
      };
    }

    const pokeRefreshed =
      isPokeTraceConfigured() ? await refreshPokeTraceCatalogPrices(id) : false;
    const pricesRefreshed =
      pokeRefreshed && isPokeTracePrimary()
        ? true
        : await refreshCatalogPricesFromTcgApi(id);
    const card = catalogSummaryToExtractedCard(
      pricesRefreshed ? (await getCardFromDb("pokemon", id)) ?? catalogCard : catalogCard,
    );

    const market = await researchCardMarket(card, {
      catalogId: id,
      profile: profile === "nightly" ? "nightly" : "scan",
    });
    await persistMarketIntelFromEnrich({
      catalogId: id,
      card,
      marketEvidence: market.marketEvidence,
    });
    await persistPriceChartingOnCatalogCard(id, market.marketEvidence);

    const popSnapshots = await persistCatalogPopulationFromMarketEvidence(
      id,
      market.marketEvidence,
    );

    let graderPopSnapshots = 0;
    if (
      isBrightDataPopHarvestEnabled() &&
      process.env.CATALOG_INGEST_GRADER_POP !== "0"
    ) {
      const graderResults = await harvestGraderPopForCatalogCard(id, {
        graders: ["PSA"],
      });
      graderPopSnapshots = graderResults.reduce((n, r) => n + r.gradesWritten, 0);
    }

    return {
      catalogId: id,
      ok: true,
      comps: market.marketEvidence.length,
      popSnapshots,
      graderPopSnapshots,
      pricesRefreshed,
      institutionalMemory: market.institutionalMemory,
    };
  } catch (e) {
    return {
      catalogId: id,
      ok: false,
      comps: 0,
      popSnapshots: 0,
      graderPopSnapshots: 0,
      pricesRefreshed: false,
      institutionalMemory: false,
      error: e instanceof Error ? e.message : "ingest_failed",
    };
  }
}
