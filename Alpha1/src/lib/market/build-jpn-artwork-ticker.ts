import { parseCatalogPriceSnapshot } from "@/lib/market/catalog-reference-evidence";
import type { LiveMarketTickerSlide } from "@/lib/market/live-market-ticker-types";
import type { CatalogPriceSnapshot } from "@/lib/market/pokemon-catalog";
import { resolveJapaneseSetReleaseYear } from "@/lib/scan/japanese-pokemon";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";

const OVERLAY_PAGE = 500;
const MIN_MATCH_CONFIDENCE = 0.85;
const TRUSTED_ARTWORK_STATUS = new Set(["exact_japanese_print", "same_art_confirmed"]);
const CARD_BATCH = 120;

type LocalizedOverlayRow = {
  base_catalog_id: string;
  localized_set_name: string | null;
  localized_name: string | null;
  printed_number: string | null;
  image_small_url: string | null;
  image_large_url: string | null;
  artwork_match_status: string;
  match_confidence: number | string | null;
};

type CatalogPriceRow = {
  catalog_id: string;
  name: string;
  set_name: string | null;
  set_code: string | null;
  card_number: string | null;
  rarity: string | null;
  prices_json: Record<string, unknown> | null;
};

type SetGroup = {
  setKey: string;
  setName: string;
  releaseYear: string | null;
  releaseSort: number;
  candidates: {
    overlay: LocalizedOverlayRow;
    card: CatalogPriceRow;
    priceUsd: number | null;
    momentumPct: number | null;
  }[];
};

function bestTcgUsd(prices: CatalogPriceSnapshot): number | null {
  let best: number | null = null;
  for (const row of prices.tcgPlayerPrices) {
    const n = row.market ?? row.mid ?? row.low;
    if (n == null || !Number.isFinite(n)) continue;
    if (best == null || n > best) best = n;
  }
  return best;
}

function bestCatalogUsd(prices: CatalogPriceSnapshot): number | null {
  const tcg = bestTcgUsd(prices);
  if (tcg != null) return tcg;
  const cm = prices.cardMarket;
  const cmUsd = cm?.trendPrice ?? cm?.averageSellPrice ?? cm?.avg30 ?? cm?.avg7 ?? cm?.lowPrice ?? null;
  if (cmUsd != null && Number.isFinite(cmUsd)) return cmUsd;
  return null;
}

function releaseSortKey(year: string | null): number {
  if (!year || !/^\d{4}$/.test(year)) return 9_999;
  return Number(year);
}

function overlayConfidence(row: LocalizedOverlayRow): number {
  const n = typeof row.match_confidence === "number" ? row.match_confidence : Number(row.match_confidence);
  return Number.isFinite(n) ? n : 0;
}

function isValidatedOverlay(row: LocalizedOverlayRow): boolean {
  if (!TRUSTED_ARTWORK_STATUS.has(row.artwork_match_status)) return false;
  if (overlayConfidence(row) < MIN_MATCH_CONFIDENCE) return false;
  return Boolean(row.image_large_url?.trim() || row.image_small_url?.trim());
}

async function loadValidatedOverlays(): Promise<LocalizedOverlayRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabaseAdmin();
  const out: LocalizedOverlayRow[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await supabase
      .from("tcg_catalog_localized_artwork")
      .select(
        "base_catalog_id,localized_set_name,localized_name,printed_number,image_small_url,image_large_url,artwork_match_status,match_confidence",
      )
      .eq("franchise", "pokemon")
      .ilike("language", "japanese")
      .in("artwork_match_status", ["exact_japanese_print", "same_art_confirmed"])
      .gte("match_confidence", MIN_MATCH_CONFIDENCE)
      .order("match_confidence", { ascending: false })
      .range(from, from + OVERLAY_PAGE - 1);

    if (error || !data?.length) break;
    const rows = (data as LocalizedOverlayRow[]).filter(isValidatedOverlay);
    out.push(...rows);
    if (data.length < OVERLAY_PAGE) break;
    from += OVERLAY_PAGE;
  }

  return out;
}

async function loadCatalogPrices(catalogIds: string[]): Promise<Map<string, CatalogPriceRow>> {
  if (!isSupabaseConfigured() || catalogIds.length === 0) return new Map();
  const supabase = getSupabaseAdmin();
  const map = new Map<string, CatalogPriceRow>();

  for (let i = 0; i < catalogIds.length; i += CARD_BATCH) {
    const chunk = catalogIds.slice(i, i + CARD_BATCH);
    const { data, error } = await supabase
      .from("tcg_catalog_cards")
      .select("catalog_id,name,set_name,set_code,card_number,rarity,prices_json")
      .eq("franchise", "pokemon")
      .in("catalog_id", chunk);
    if (error || !data) continue;
    for (const row of data as CatalogPriceRow[]) {
      map.set(row.catalog_id, row);
    }
  }

  return map;
}

async function loadSetReleaseDates(setCodes: string[]): Promise<Map<string, string>> {
  if (!isSupabaseConfigured() || setCodes.length === 0) return new Map();
  const supabase = getSupabaseAdmin();
  const unique = [...new Set(setCodes.filter(Boolean))];
  const map = new Map<string, string>();

  for (let i = 0; i < unique.length; i += CARD_BATCH) {
    const chunk = unique.slice(i, i + CARD_BATCH);
    const { data } = await supabase
      .from("tcg_catalog_sets")
      .select("code,release_date")
      .eq("franchise", "pokemon")
      .in("code", chunk);
    for (const row of data ?? []) {
      const code = row.code ? String(row.code) : "";
      const date = row.release_date ? String(row.release_date).slice(0, 10) : "";
      if (code && date) map.set(code, date);
    }
  }

  return map;
}

/**
 * Vintage → modern Japanese-art tour: validated overlay images + EN catalog prices on base_catalog_id.
 */
export async function buildJpnArtworkTickerSlides(): Promise<LiveMarketTickerSlide[]> {
  const overlays = await loadValidatedOverlays();
  if (!overlays.length) return [];

  const byBaseId = new Map<string, LocalizedOverlayRow>();
  for (const row of overlays) {
    const existing = byBaseId.get(row.base_catalog_id);
    if (!existing || overlayConfidence(row) > overlayConfidence(existing)) {
      byBaseId.set(row.base_catalog_id, row);
    }
  }

  const catalogIds = [...byBaseId.keys()];
  const prices = await loadCatalogPrices(catalogIds);
  const releaseDates = await loadSetReleaseDates(
    [...prices.values()].map((c) => c.set_code).filter(Boolean) as string[],
  );

  const groups = new Map<string, SetGroup>();

  for (const [baseId, overlay] of byBaseId) {
    const card = prices.get(baseId);
    if (!card) continue;

    const priceSnapshot = parseCatalogPriceSnapshot(card.prices_json);
    const priceUsd = bestCatalogUsd(priceSnapshot);
    const setKey = (overlay.localized_set_name ?? card.set_name ?? card.set_code ?? "unknown").trim();
    const englishSet = card.set_name ?? null;
    const dbRelease = card.set_code ? releaseDates.get(card.set_code) ?? null : null;
    const releaseYear = resolveJapaneseSetReleaseYear({
      localizedSetName: overlay.localized_set_name,
      englishSetName: englishSet,
      releaseDate: dbRelease,
    });

    let group = groups.get(setKey);
    if (!group) {
      group = {
        setKey,
        setName: overlay.localized_set_name ?? englishSet ?? setKey,
        releaseYear,
        releaseSort: releaseSortKey(releaseYear),
        candidates: [],
      };
      groups.set(setKey, group);
    } else if (releaseSortKey(releaseYear) < group.releaseSort) {
      group.releaseYear = releaseYear;
      group.releaseSort = releaseSortKey(releaseYear);
    }

    group.candidates.push({
      overlay,
      card,
      priceUsd,
      momentumPct: null,
    });
  }

  const sortedGroups = [...groups.values()].sort((a, b) => {
    if (a.releaseSort !== b.releaseSort) return a.releaseSort - b.releaseSort;
    return a.setName.localeCompare(b.setName);
  });

  const slides: LiveMarketTickerSlide[] = [];

  for (const group of sortedGroups) {
    const best = [...group.candidates].sort((a, b) => (b.priceUsd ?? 0) - (a.priceUsd ?? 0))[0];
    if (!best) continue;

    const { overlay, card, priceUsd } = best;
    const displayName = overlay.localized_name ?? card.name;
    slides.push({
      lane: "jpn_art",
      setId: card.set_code ?? group.setKey,
      setName: group.setName,
      setCode: card.set_code,
      releaseYear: group.releaseYear,
      catalogId: card.catalog_id,
      cardName: displayName,
      cardNumber: overlay.printed_number ?? card.card_number,
      rarity: card.rarity,
      imageUrl: overlay.image_large_url ?? overlay.image_small_url ?? null,
      priceUsd: priceUsd != null ? Math.round(priceUsd * 100) / 100 : null,
      priceLabel:
        priceUsd != null
          ? "TCGPlayer (EN catalog ref)"
          : overlay.artwork_match_status === "exact_japanese_print"
            ? "Japanese print · price pending"
            : "Japanese art · EN reference",
    });
  }

  return slides;
}

export type JpnArtworkTickerValidation = {
  ok: boolean;
  slideCount: number;
  overlayRows: number;
  issues: string[];
};

/** Server-side sanity checks before publishing the JPN lane. */
export async function validateJpnArtworkTickerBuild(
  slides: LiveMarketTickerSlide[],
): Promise<JpnArtworkTickerValidation> {
  const issues: string[] = [];
  const overlays = await loadValidatedOverlays();

  if (overlays.length === 0) {
    issues.push("no_validated_japanese_overlay_rows");
  }
  if (slides.length === 0) {
    issues.push("no_jpn_slides_built");
  }

  let lastSort = -1;
  for (let i = 0; i < slides.length; i += 1) {
    const slide = slides[i]!;
    if (slide.lane !== "jpn_art") issues.push(`slide_${i}_wrong_lane`);
    if (!slide.imageUrl?.trim()) issues.push(`slide_${i}_missing_jpn_image`);
    const sort = releaseSortKey(slide.releaseYear);
    if (sort < lastSort) issues.push(`slide_${i}_out_of_vintage_order`);
    lastSort = sort;
  }

  const seenSets = new Set<string>();
  for (const slide of slides) {
    if (seenSets.has(slide.setName)) issues.push(`duplicate_set:${slide.setName}`);
    seenSets.add(slide.setName);
  }

  return {
    ok: issues.length === 0,
    slideCount: slides.length,
    overlayRows: overlays.length,
    issues,
  };
}
