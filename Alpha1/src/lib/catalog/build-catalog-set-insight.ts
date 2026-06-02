import { syncSetCatalogPricesFromTcgApi } from "@/lib/catalog/catalog-set-price-sync";
import { hydrateSetUsMomentum } from "@/lib/market/hydrate-catalog-momentum";
import { loadSetMarketEvidenceMap } from "@/lib/catalog/set-insight-comps";
import { listCardsFromDb } from "@/lib/catalog/db-catalog-browse";
import type { CatalogSetInsightPayload, SetInsightPriceCard } from "@/lib/catalog/set-insight-payload";
import {
  defaultModernSealedProducts,
  mergeSealedProducts,
  sealedProductsFromOverlay,
} from "@/lib/catalog/set-insight-sealed";
import {
  isSetInsightAiConfigured,
  researchSetInsightWithAi,
} from "@/lib/catalog/set-insight-ai";
import {
  groqRawToCards,
  groqRawToPromos,
  groqRawToSealed,
} from "@/lib/catalog/set-insight-groq";
import {
  cardInsightPriceLabel,
  cardInsightRow,
  enrichCardsWithLiveTcgPrices,
  promoCardsInSet,
  rollupSetInsightCards,
  topMomentumCards,
  topValueCards,
  type SetInsightCardSource,
} from "@/lib/catalog/set-insight-utils";
import type { MarketEvidence } from "@/lib/scan/schemas";
import { getCatalogSetOverlay, hasCatalogSetOverlay } from "@/lib/pokedex/catalog-set-overlay";
import { formatPokemonCatalogSkuLabel } from "@/lib/catalog/parse-catalog-sku";
import { rollupCatalogSetPricing } from "@/lib/pokedex/set-pricing-aggregate";
import {
  CATALOG_SET_PRICING_SELECT,
  fetchAllCardsForSet,
  fetchSetById,
} from "@/lib/pokedex/tcg-api-server";
import type { TcgCardSummary } from "@/lib/pokedex/tcg-api-types";
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
      priceUsd: insight.priceUsd ?? row.priceUsd,
      priceLabel: insight.priceLabel ?? row.priceLabel,
      momentumPct: insight.momentumPct ?? row.momentumPct,
      momentumLabel: insight.momentumLabel ?? row.momentumLabel,
      momentumDeltaUsd: insight.momentumDeltaUsd ?? row.momentumDeltaUsd,
      momentumRegion: insight.momentumRegion ?? row.momentumRegion,
    };
  });
}

function catalogRowsToInsight(
  cards: SetInsightCardSource[],
  evidenceByCatalogId?: Map<string, MarketEvidence[]>,
): {
  topValue: SetInsightPriceCard[];
  momentum: SetInsightPriceCard[];
  promos: SetInsightPriceCard[];
} {
  const mapRow = (card: SetInsightCardSource): SetInsightPriceCard => {
    const ev = evidenceByCatalogId?.get(card.id);
    const r = cardInsightRow(card, ev);
    return {
      catalogId: r.catalogId,
      name: r.name,
      number: r.number,
      rarity: r.rarity,
      imageUrl: r.imageUrl,
      priceUsd: r.priceUsd,
      priceLabel: r.priceLabel ?? cardInsightPriceLabel(card, ev),
      momentumPct: r.momentumPct,
      momentumLabel: r.momentumLabel,
      momentumDeltaUsd: r.momentumDeltaUsd,
      momentumRegion: r.momentumRegion,
    };
  };

  return {
    topValue: topValueCards(cards, SET_INSIGHT_TOP_VALUE_POOL, evidenceByCatalogId).map((r) => {
      const card = cards.find((c) => c.id === r.catalogId);
      return card ? mapRow(card) : { ...r, priceLabel: "TCGPlayer market" };
    }),
    momentum: topMomentumCards(cards, SET_INSIGHT_MOVER_SEED_LIMIT, evidenceByCatalogId).map((r) => {
      const card = cards.find((c) => c.id === r.catalogId);
      return card ? mapRow(card) : { ...r, priceLabel: "TCGPlayer market" };
    }),
    promos: promoCardsInSet(cards, 6, evidenceByCatalogId).map((r) => {
      const card = cards.find((c) => c.id === r.catalogId);
      return card ? mapRow(card) : { ...r, priceLabel: "TCGPlayer market" };
    }),
  };
}

import {
  SET_INSIGHT_MOVER_SEED_LIMIT,
  SET_INSIGHT_TOP_VALUE_LIMIT,
  SET_INSIGHT_TOP_VALUE_POOL,
} from "@/lib/catalog/set-insight-limits";

function topValueRowKey(row: SetInsightPriceCard): string {
  return row.catalogId?.trim() || normalizeName(row.name);
}

function isGroqFreshPriceLabel(label: string | null | undefined): boolean {
  if (!label?.trim()) return false;
  return /sold|active|reference|tcgplayer/i.test(label);
}

function findGroqTopValueMatch(
  row: SetInsightPriceCard,
  groq: SetInsightPriceCard[],
): SetInsightPriceCard | undefined {
  const id = row.catalogId?.trim();
  if (id) {
    const byId = groq.find((g) => g.catalogId === id);
    if (byId) return byId;
  }
  const nameKey = normalizeName(row.name);
  return groq.find((g) => normalizeName(g.name) === nameKey);
}

/**
 * Catalog-ranked top value first; Groq only refreshes prices on matched set cards (no random inserts).
 */
function mergeTopValueCards(
  catalog: SetInsightPriceCard[],
  groq: SetInsightPriceCard[],
): SetInsightPriceCard[] {
  const merged: SetInsightPriceCard[] = catalog
    .filter((row) => row.priceUsd != null)
    .map((row) => {
      const hint = findGroqTopValueMatch(row, groq);
      if (!hint?.priceUsd) return row;
      const groqUsd = hint.priceUsd;
      const catalogUsd = row.priceUsd ?? 0;
      const sane =
        groqUsd >= catalogUsd * 0.65 && groqUsd <= catalogUsd * 1.75;
      const preferGroq = isGroqFreshPriceLabel(hint.priceLabel) && sane;
      if (!preferGroq) return row;
      return {
        ...row,
        priceUsd: groqUsd,
        priceLabel: hint.priceLabel ?? row.priceLabel,
        note: hint.note ?? row.note,
      };
    });

  const seen = new Set(merged.map(topValueRowKey));
  for (const row of groq) {
    if (!row.catalogId || row.priceUsd == null) continue;
    const key = topValueRowKey(row);
    if (seen.has(key)) continue;
    merged.push(row);
    seen.add(key);
  }

  return merged
    .sort((a, b) => (b.priceUsd ?? 0) - (a.priceUsd ?? 0))
    .slice(0, SET_INSIGHT_TOP_VALUE_LIMIT);
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
  return out.slice(0, SET_INSIGHT_TOP_VALUE_LIMIT);
}

/** Full-set cards + live TCG price enrichment (set insight, market movers). */
export async function loadSetCardsForCatalogInsight(setId: string): Promise<{
  cards: SetInsightCardSource[];
  tcgCards: TcgCardSummary[];
}> {
  const db = await listCardsFromDb("pokemon", setId, {
    page: 1,
    pageSize: 3000,
    includeVariants: false,
  });
  let cards: SetInsightCardSource[] = db?.data.length ? db.data : [];
  let tcgCards: TcgCardSummary[] = [];

  const pricedBeforeLive = cards.length ? rollupSetInsightCards(cards).pricedSlots : 0;
  const needsLivePrices =
    cards.length === 0 ||
    pricedBeforeLive === 0 ||
    pricedBeforeLive / cards.length < divisorForLivePriceFetch(cards.length);

  if (needsLivePrices) {
    try {
      tcgCards = await fetchAllCardsForSet({
        setId,
        select: CATALOG_SET_PRICING_SELECT,
      });
    } catch {
      tcgCards = [];
    }
  }

  if (!cards.length && tcgCards.length) {
    cards = tcgCards;
  } else if (cards.length && tcgCards.length) {
    cards = enrichCardsWithLiveTcgPrices(cards, tcgCards);
  }

  return { cards, tcgCards };
}

/** Fetch live TCG API prices when catalog snapshots are sparse. */
function divisorForLivePriceFetch(cardCount: number): number {
  if (cardCount <= 30) return 0.15;
  if (cardCount <= 120) return 0.08;
  return 0.03;
}

export async function buildCatalogSetInsight(
  setId: string,
  options?: { refreshAi?: boolean },
): Promise<CatalogSetInsightPayload> {
  const refreshedAt = new Date().toISOString();
  const set = await fetchSetById(setId);
  const setName = set?.name ?? setId;
  const releaseDate = set?.releaseDate ?? null;

  let { cards, tcgCards } = await loadSetCardsForCatalogInsight(setId);
  let insightRollup = rollupSetInsightCards(cards);
  let evidenceByCatalogId = new Map<string, MarketEvidence[]>();
  const pricedPctEarly =
    insightRollup.cardCount > 0
      ? insightRollup.pricedSlots / insightRollup.cardCount
      : 0;

  if (pricedPctEarly < 0.5 && process.env.CATALOG_SET_INSIGHT_SKIP_PRICE_SYNC !== "1") {
    try {
      await syncSetCatalogPricesFromTcgApi(setId);
      const reloaded = await loadSetCardsForCatalogInsight(setId);
      cards = reloaded.cards;
      tcgCards = reloaded.tcgCards;
      insightRollup = rollupSetInsightCards(cards);
    } catch {
      /* continue with partial catalog */
    }
  }

  if (process.env.CATALOG_MOMENTUM_HYDRATE !== "0") {
    cards = await hydrateSetUsMomentum(cards);
  }

  evidenceByCatalogId = await loadSetMarketEvidenceMap(cards.map((c) => c.id));
  insightRollup = rollupSetInsightCards(cards, evidenceByCatalogId);
  const tcgRollup =
    tcgCards.length > 0 && insightRollup.pricedSlots === 0
      ? rollupCatalogSetPricing(tcgCards)
      : {
          cardCount: insightRollup.cardCount,
          tcgPlayerSumUsd: insightRollup.tcgPlayerSumUsd,
          tcgPlayerPricedSlots: insightRollup.pricedSlots,
          cardmarketSumEur: 0,
          cardmarketPricedSlots: 0,
        };

  const pricedPct =
    tcgRollup.cardCount > 0
      ? Math.round((100 * tcgRollup.tcgPlayerPricedSlots) / tcgRollup.cardCount)
      : 0;

  const catalogInsight = catalogRowsToInsight(cards, evidenceByCatalogId);
  const catalogHints = topValueCards(cards, 15, evidenceByCatalogId).map((r) =>
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
  let sealedProducts = hasCatalogSetOverlay(setId)
    ? sealedProductsFromOverlay(setName, getCatalogSetOverlay(setId)?.sealedProducts ?? [])
    : sealedProductsFromOverlay(setName, defaultModernSealedProducts(setName));
  const references: { label: string; url: string }[] = [];

  const overlay = getCatalogSetOverlay(setId);
  if (overlay?.setValueNotes) {
    chaseNotes = overlay.setValueNotes;
  }
  if (overlay?.bulbapediaUrl) {
    references.push({ label: "Bulbapedia", url: overlay.bulbapediaUrl });
  }

  const aiEnabled =
    process.env.CATALOG_SET_INSIGHT_DISABLE_GROQ !== "1" && isSetInsightAiConfigured();

  if (aiEnabled) {
    const groq = await researchSetInsightWithAi(
      {
        setId,
        setName,
        releaseDate,
        cardCount: tcgRollup.cardCount,
        catalogHints: catalogHints.length ? catalogHints : cards.slice(0, 15).map((c) => c.name),
        pricedSlots: tcgRollup.tcgPlayerPricedSlots,
        pricedPct,
        topValueCount: catalogInsight.topValue.length,
        momentumCount: catalogInsight.momentum.length,
      },
      { forceAi: options?.refreshAi },
    );

    if (groq) {
      model = `${groq.provider}:${groq.model}`;
      source =
        catalogInsight.topValue.length || groq.provider === "gemini"
          ? "hybrid"
          : "groq";
      summary = groq.raw.summary?.trim() ?? null;
      marketPulse = groq.raw.marketPulse?.trim() ?? null;
      chaseNotes = groq.raw.chaseNotes?.trim() ?? chaseNotes;

      const groqTop = attachCatalogIds(groqRawToCards(groq.raw.topValueCards), cards);
      const groqPromo = attachCatalogIds(groqRawToPromos(groq.raw.promoCards), cards);
      const groqSealed = groqRawToSealed(groq.raw.sealedProducts);

      topValue = mergeTopValueCards(catalogInsight.topValue, groqTop);
      // Movers: catalog 7d/30d math only (accurate %); Groq does not override momentum.
      momentum = catalogInsight.momentum;
      promos = mergeCardLists(catalogInsight.promos, groqPromo);

      if (groqSealed.length) {
        sealedProducts = mergeSealedProducts(sealedProducts, groqSealed);
      }

      for (const ref of groq.raw.references ?? []) {
        const label = ref.label?.trim();
        const url = ref.url?.trim();
        if (label && url?.startsWith("http")) references.push({ label, url });
      }
    }
  }

  if (!summary && topValue.length) {
    const lead = topValue[0];
    summary = `${setName}: top catalog signal is ${lead.name}${lead.priceUsd != null ? ` around $${Math.round(lead.priceUsd)}` : ""} (${lead.priceLabel ?? "reference"}).`;
  }

  if (!summary && tcgRollup.tcgPlayerPricedSlots > 0) {
    summary = `${setName}: ${tcgRollup.tcgPlayerPricedSlots} of ${tcgRollup.cardCount} cards have TCGPlayer prices in catalog (${pricedPct}% coverage).`;
  } else if (!summary && cards.length > 0) {
    summary = `${setName}: ${cards.length} cards in catalog — run catalog sync to load TCGPlayer prices, or add GROQ_API_KEY for live set research.`;
  }

  const chaseCard = topValue[0] ?? null;
  const chaseSku =
    chaseCard?.catalogId != null
      ? formatPokemonCatalogSkuLabel(chaseCard.catalogId, chaseCard.number)
      : null;

  const editorialNotes =
    [marketPulse?.trim(), chaseNotes?.trim()]
      .filter((s, i, arr) => Boolean(s) && arr.indexOf(s) === i)
      .join(" · ")
      .trim() || chaseNotes;

  const ready =
    cards.length > 0 &&
    (tcgRollup.tcgPlayerPricedSlots > 0 ||
      Boolean(summary) ||
      topValue.length > 0 ||
      momentum.length > 0 ||
      sealedProducts.length > 0 ||
      Boolean(chaseNotes));

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
    editorialNotes,
    chaseCard,
    chaseSku,
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
