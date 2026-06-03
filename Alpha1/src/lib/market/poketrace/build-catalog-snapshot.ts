import { getCardFromDb } from "@/lib/catalog/db-catalog-browse";
import type { CatalogCardSummary } from "@/lib/catalog/catalog-types";
import { parseCatalogPriceSnapshot } from "@/lib/market/catalog-reference-evidence";
import { isPokeTraceConfigured } from "@/lib/market/env-market";
import { isPokeTraceRateLimited } from "@/lib/market/poketrace/rate-limit";
import { resolvedCatalogMomentumPct } from "@/lib/market/catalog-momentum";
import { fetchPokeTracePriceHistory } from "@/lib/market/poketrace/history";
import {
  fetchPokeTraceCardById,
  searchPokeTraceCards,
  scoreCardMatch,
} from "@/lib/market/poketrace/match";
import { buildCatalogSnapshotFromPokeTrace } from "@/lib/market/poketrace/snapshot";
import { marketForCard, pickPrimaryTierRow } from "@/lib/market/poketrace/tiers";
import type { PokeTraceCard } from "@/lib/market/poketrace/types";
import { catalogSummaryToExtractedCard } from "@/lib/market/pokemon-market-knowledge-shared";
import type { CatalogPriceSnapshot } from "@/lib/market/pokemon-catalog";

async function resolvePokeTraceCard(
  catalogCard: CatalogCardSummary,
  extracted = catalogSummaryToExtractedCard(catalogCard),
): Promise<PokeTraceCard | null> {
  const stored = parseCatalogPriceSnapshot(catalogCard.prices ?? null).pokeTrace?.cardId ?? null;
  if (stored) {
    const byId = await fetchPokeTraceCardById(stored);
    if (byId) return byId;
  }

  const candidates = await searchPokeTraceCards(extracted);
  const ranked = candidates
    .map((c) => ({ c, score: scoreCardMatch(c, extracted) }))
    .sort((a, b) => b.score - a.score);
  if (!ranked[0]?.c || (ranked[0]?.score ?? 0) < 4) return null;
  return ranked[0].c;
}

/** Build PokeTrace-enriched price snapshot for one catalog card (no DB write). */
export async function buildPokeTraceCatalogSnapshot(
  catalogId: string,
): Promise<CatalogPriceSnapshot | null> {
  if (!isPokeTraceConfigured()) return null;

  const id = catalogId.trim();
  if (!id) return null;

  const catalogCard = await getCardFromDb("pokemon", id);
  if (!catalogCard) return null;

  const existing = parseCatalogPriceSnapshot(catalogCard.prices ?? null);
  if (resolvedCatalogMomentumPct(existing) != null) {
    return existing;
  }
  if (isPokeTraceRateLimited()) return null;

  const extracted = catalogSummaryToExtractedCard(catalogCard);
  const pokeCard = await resolvePokeTraceCard(catalogCard, extracted);
  if (!pokeCard) return null;

  const primary = pickPrimaryTierRow(extracted, pokeCard);
  let historyPoints = 0;
  if (primary) {
    const history = await fetchPokeTracePriceHistory(pokeCard.id, primary.tier, {
      period: "90d",
      limit: 14,
    });
    historyPoints = history.length;
  }

  const { snapshot } = buildCatalogSnapshotFromPokeTrace(pokeCard, extracted, {
    existing,
    historyPoints,
    market: marketForCard(extracted),
  });

  return snapshot;
}
