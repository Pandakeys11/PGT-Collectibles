import { listCardsFromDb } from "@/lib/catalog/db-catalog-browse";
import type {
  CatalogSetInsightPayload,
  SetInsightPriceCard,
  SetInsightSealedProduct,
} from "@/lib/catalog/set-insight-payload";
import { refreshPokemonMarketKnowledge } from "@/lib/market/refresh-pokemon-market-knowledge";
import { readCatalogMarketIntel } from "@/lib/pgt-registry/pgt-market-intel-persist";
import {
  groqRawToCards,
  groqRawToMomentum,
  groqRawToPromos,
  groqRawToSealed,
  isSetInsightGroqConfigured,
  researchSetInsightWithGroq,
} from "@/lib/catalog/set-insight-groq";
import {
  cardInsightRow,
  promoCardsInSet,
  rollupSetInsightCards,
  topMomentumCards,
  topValueCards,
  type SetInsightCardSource,
} from "@/lib/catalog/set-insight-utils";
import {
  getCatalogSetOverlay,
  hasCatalogSetOverlay,
  type SealedProductSpec,
} from "@/lib/pokedex/catalog-set-overlay";
import { buildMarketSourceLinks } from "@/lib/market/sources";
import { rollupCatalogSetPricing } from "@/lib/pokedex/set-pricing-aggregate";
import {
  CATALOG_SET_PRICING_SELECT,
  fetchAllCardsForSet,
  fetchSetById,
} from "@/lib/pokedex/tcg-api-server";
import type { TcgCardSummary } from "@/lib/pokedex/tcg-api-types";
import { extractedCardSchema } from "@/lib/scan/schemas";

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function attachCatalogIds(
  rows: SetInsightPriceCard[],
  catalog: SetInsightCardSource[],
): SetInsightPriceCard[] {
  const byName = new Map<string, SetInsightCardSource>();
  for (const c of catalog) {
    byName.set(normalizeName(c.name), c);
  }
  return rows.map((row) => {
    const hit =
      byName.get(normalizeName(row.name)) ??
      catalog.find(
        (c) =>
          row.number &&
          c.number &&
          normalizeName(c.name) === normalizeName(row.name) &&
          c.number.replace(/^0+/, "") === row.number.replace(/^0+/, ""),
      );
    if (!hit) return row;
    const insight = cardInsightRow(hit);
    return {
      ...row,
      catalogId: hit.id,
      imageUrl: insight.imageUrl,
      priceUsd: row.priceUsd ?? insight.priceUsd,
      momentumPct: row.momentumPct ?? insight.momentumPct,
    };
  });
}

function catalogRowsToInsight(cards: SetInsightCardSource[]): {
  topValue: SetInsightPriceCard[];
  momentum: SetInsightPriceCard[];
  promos: SetInsightPriceCard[];
} {
  const mapRow = (r: ReturnType<typeof cardInsightRow>): SetInsightPriceCard => ({
    catalogId: r.catalogId,
    name: r.name,
    number: r.number,
    rarity: r.rarity,
    imageUrl: r.imageUrl,
    priceUsd: r.priceUsd,
    priceLabel: "TCGPlayer market",
    momentumPct: r.momentumPct,
  });

  return {
    topValue: topValueCards(cards, 8).map(mapRow),
    momentum: topMomentumCards(cards, 6).map(mapRow),
    promos: promoCardsInSet(cards, 6).map(mapRow),
  };
}

function bestSoldHighUsd(intel: Awaited<ReturnType<typeof readCatalogMarketIntel>>): number | null {
  if (!intel?.comps?.length) return null;
  let best: number | null = null;
  for (const row of intel.comps) {
    if (row.kind !== "sold") continue;
    const n = row.priceUsd;
    if (n == null || !Number.isFinite(n) || n <= 0) continue;
    if (best == null || n > best) best = n;
  }
  return best;
}

async function attachSoldHighs(args: {
  setId: string;
  cards: SetInsightCardSource[];
  seed: SetInsightPriceCard[];
}): Promise<SetInsightPriceCard[]> {
  // Seed is currently derived from catalog price snapshots (TCGPlayer market).
  // We upgrade it using stored + (optionally) live-ingested sold highs.
  const seedById = new Map<string, SetInsightPriceCard>();
  for (const row of args.seed) {
    const id = row.catalogId?.trim();
    if (id) seedById.set(id, row);
  }

  const candidateIds = args.seed
    .map((r) => r.catalogId ?? "")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 14);

  if (candidateIds.length === 0) return args.seed;

  const intelById = new Map<string, Awaited<ReturnType<typeof readCatalogMarketIntel>>>();
  await Promise.all(
    candidateIds.map(async (id) => {
      const intel = await readCatalogMarketIntel(id, { compLimit: 60 });
      intelById.set(id, intel);
    }),
  );

  const hits = candidateIds
    .map((id) => ({ id, soldHigh: bestSoldHighUsd(intelById.get(id) ?? null) }))
    .filter((row) => row.soldHigh != null);

  // If we have almost no sold highs yet, run a small live refresh batch for the top candidates.
  if (hits.length < 3) {
    const refreshIds = candidateIds.slice(0, 6);
    await Promise.allSettled(
      refreshIds.map((id) => refreshPokemonMarketKnowledge(id, { force: false })),
    );
    await Promise.all(
      refreshIds.map(async (id) => {
        const intel = await readCatalogMarketIntel(id, { compLimit: 80 });
        intelById.set(id, intel);
      }),
    );
  }

  const enriched = args.seed.map((row) => {
    const id = row.catalogId?.trim();
    if (!id) return row;
    const intel = intelById.get(id) ?? null;
    const soldHigh = bestSoldHighUsd(intel);
    if (soldHigh == null) return row;
    return {
      ...row,
      priceUsd: soldHigh,
      priceLabel: "Sold high (PGT memory + live)",
    } satisfies SetInsightPriceCard;
  });

  // Re-sort by best available price.
  return enriched
    .slice()
    .sort((a, b) => (b.priceUsd ?? 0) - (a.priceUsd ?? 0))
    .slice(0, 10);
}

function mergeCardLists(
  catalog: SetInsightPriceCard[],
  groq: SetInsightPriceCard[],
): SetInsightPriceCard[] {
  if (!groq.length) return catalog;
  if (!catalog.length) return groq;
  const seen = new Set(catalog.map((r) => normalizeName(r.name)));
  const out = [...catalog];
  for (const row of groq) {
    if (seen.has(normalizeName(row.name))) continue;
    seen.add(normalizeName(row.name));
    out.push(row);
  }
  return out.slice(0, 10);
}

async function loadSetCards(setId: string): Promise<{
  cards: SetInsightCardSource[];
  tcgCards: TcgCardSummary[];
}> {
  const db = await listCardsFromDb("pokemon", setId, {
    page: 1,
    pageSize: 3000,
    includeVariants: false,
  });
  if (db?.data.length) {
    return { cards: db.data, tcgCards: [] };
  }
  const tcgCards = await fetchAllCardsForSet({
    setId,
    select: CATALOG_SET_PRICING_SELECT,
  });
  return { cards: tcgCards, tcgCards };
}

function sealedFromOverlay(setName: string, products: SealedProductSpec[]): SetInsightSealedProduct[] {
  return products.map((p) => {
    const extracted = extractedCardSchema.parse({
      name: p.searchQuery,
      set: setName,
      printStamps: "sealed pokemon tcg",
    });
    const links = buildMarketSourceLinks(extracted);
    const ebay = links.find((l) => l.source === "ebay" && l.lane === "sold")?.url;
    return {
      label: p.label,
      note: p.category.replace(/_/g, " "),
      searchUrl: ebay ?? links[0]?.url ?? null,
    };
  });
}

export async function buildCatalogSetInsight(setId: string): Promise<CatalogSetInsightPayload> {
  const refreshedAt = new Date().toISOString();
  const set = await fetchSetById(setId);
  const setName = set?.name ?? setId;
  const releaseDate = set?.releaseDate ?? null;

  const { cards, tcgCards } = await loadSetCards(setId);
  const rollupSource = tcgCards.length ? tcgCards : cards;
  const tcgRollup =
    tcgCards.length > 0
      ? rollupCatalogSetPricing(tcgCards)
      : {
          cardCount: cards.length,
          tcgPlayerSumUsd: rollupSetInsightCards(cards).tcgPlayerSumUsd,
          tcgPlayerPricedSlots: rollupSetInsightCards(cards).pricedSlots,
          cardmarketSumEur: 0,
          cardmarketPricedSlots: 0,
        };

  const pricedPct =
    tcgRollup.cardCount > 0
      ? Math.round((100 * tcgRollup.tcgPlayerPricedSlots) / tcgRollup.cardCount)
      : 0;

  const catalogInsight = catalogRowsToInsight(cards);
  const catalogHints = topValueCards(cards, 15).map((r) =>
    [r.name, r.number ? `#${r.number}` : null, r.rarity].filter(Boolean).join(" · "),
  );

  let source: CatalogSetInsightPayload["source"] = "catalog";
  let model: string | null = null;
  let summary: string | null = null;
  let marketPulse: string | null = null;
  let chaseNotes: string | null = null;
  let topValue = catalogInsight.topValue;
  let momentum = catalogInsight.momentum;
  let promos = catalogInsight.promos;
  let sealedProducts: SetInsightSealedProduct[] = hasCatalogSetOverlay(setId)
    ? sealedFromOverlay(setName, getCatalogSetOverlay(setId)?.sealedProducts ?? [])
    : [];
  const references: { label: string; url: string }[] = [];

  const overlay = getCatalogSetOverlay(setId);
  if (overlay?.setValueNotes) {
    chaseNotes = overlay.setValueNotes;
  }
  if (overlay?.bulbapediaUrl) {
    references.push({ label: "Bulbapedia", url: overlay.bulbapediaUrl });
  }

  if (isSetInsightGroqConfigured()) {
    const groq = await researchSetInsightWithGroq({
      setId,
      setName,
      releaseDate,
      cardCount: tcgRollup.cardCount,
      catalogHints: catalogHints.length ? catalogHints : cards.slice(0, 15).map((c) => c.name),
      pricedSlots: tcgRollup.tcgPlayerPricedSlots,
    });

    if (groq) {
      model = groq.model;
      source = catalogInsight.topValue.length ? "hybrid" : "groq";
      summary = groq.raw.summary?.trim() ?? null;
      marketPulse = groq.raw.marketPulse?.trim() ?? null;
      chaseNotes = groq.raw.chaseNotes?.trim() ?? chaseNotes;

      const groqTop = attachCatalogIds(groqRawToCards(groq.raw.topValueCards), cards);
      const groqMom = attachCatalogIds(groqRawToMomentum(groq.raw.momentumCards), cards);
      const groqPromo = attachCatalogIds(groqRawToPromos(groq.raw.promoCards), cards);
      const groqSealed = groqRawToSealed(groq.raw.sealedProducts);

      topValue = mergeCardLists(catalogInsight.topValue, groqTop);
      momentum = mergeCardLists(catalogInsight.momentum, groqMom);
      promos = mergeCardLists(catalogInsight.promos, groqPromo);

      if (groqSealed.length) {
        sealedProducts = groqSealed;
      }

      for (const ref of groq.raw.references ?? []) {
        const label = ref.label?.trim();
        const url = ref.url?.trim();
        if (label && url?.startsWith("http")) references.push({ label, url });
      }
    }
  }

  // Final pass: prefer real sold highs (stored + live refresh) for "highest value" cards.
  // This is where chase cards should show up even when TCGPlayer market prices are noisy.
  topValue = await attachSoldHighs({ setId, cards, seed: topValue });

  if (!summary && topValue.length) {
    const lead = topValue[0];
    summary = `${setName}: top catalog signal is ${lead.name}${lead.priceUsd != null ? ` around $${Math.round(lead.priceUsd)}` : ""} (${lead.priceLabel ?? "reference"}).`;
  }

  const ready =
    Boolean(summary) ||
    topValue.length > 0 ||
    momentum.length > 0 ||
    sealedProducts.length > 0 ||
    Boolean(chaseNotes);

  return {
    ready,
    setId,
    setName,
    releaseDate,
    refreshedAt,
    source,
    model,
    summary,
    marketPulse,
    chaseNotes,
    setWide: {
      cardCount: tcgRollup.cardCount,
      tcgPlayerSumUsd: Math.round(tcgRollup.tcgPlayerSumUsd * 100) / 100,
      pricedSlots: tcgRollup.tcgPlayerPricedSlots,
      pricedPct,
    },
    topValue,
    momentum,
    promos,
    sealedProducts,
    references: references.slice(0, 6),
  };
}
